import { useRef, useState, type ReactNode } from "react";
import { startPostgres, startPython, type Engine, type Output } from "../lib/engines";

export type Step = { title: string; why: string; code: string; expectError?: boolean };

const ENGINES = {
  python: { label: "Python 3 · runs in your browser (Pyodide)", load: "Loading Python in your browser, about 12 MB the first time…" },
  postgres: { label: "PostgreSQL · runs in your browser (PGlite)", load: "Loading PostgreSQL in your browser, a few MB the first time…" },
};

const fmt = (v: unknown) => v === null || v === undefined ? "null" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? (v ? "✓ true" : "✗ false") : typeof v === "object" ? JSON.stringify(v) : String(v);

function Out({ o, expectError }: { o: Output; expectError?: boolean }) {
  if (o.kind === "error") return (
    <div className={"run-out err" + (expectError ? " expected" : "")} role="status">
      <b>{expectError ? "Blocked, as designed:" : "Error:"}</b>
      <pre>{o.text}</pre>
    </div>
  );
  if (o.kind === "text") return <div className="run-out" role="status"><pre>{o.text}</pre></div>;
  return (
    <div className="run-out" role="status">
      <div className="table-wrap"><table>
        <thead><tr>{o.table.fields.map((f) => <th key={f}>{f}</th>)}</tr></thead>
        <tbody>{o.table.rows.map((r, k) => <tr key={k}>{o.table.fields.map((f) => <td key={f} className={typeof r[f] === "number" ? "num" : ""}>{fmt(r[f])}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>{o.table.rows.length} row{o.table.rows.length === 1 ? "" : "s"}{o.note ? " · " + o.note : ""}</p>
    </div>
  );
}

/** A notebook in steps: explanation, editable code, Run, real output. Steps share one session. */
export function Runner({ engine, steps, files = {}, intro }: { engine: "python" | "postgres"; steps: Step[]; files?: Record<string, string>; intro?: ReactNode }) {
  const [cur, setCur] = useState(0);
  const [codes, setCodes] = useState(steps.map((s) => s.code));
  const [outs, setOuts] = useState<(Output | null)[]>(steps.map(() => null));
  const [ran, setRan] = useState<boolean[]>(steps.map(() => false));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [busy, setBusy] = useState(-1);
  const eng = useRef<Promise<Engine> | null>(null);
  const ranRef = useRef(ran); ranRef.current = ran;

  const getEngine = () => {
    if (!eng.current) {
      setStatus("loading");
      eng.current = (engine === "python" ? startPython(files) : startPostgres())
        .then((e) => { setStatus("ready"); return e; })
        .catch((err) => { setStatus("failed"); eng.current = null; throw err; });
    }
    return eng.current;
  };

  const runOne = async (e: Engine, i: number) => {
    setBusy(i);
    const o = await e.run(codes[i]);
    setOuts((s) => s.map((x, j) => (j === i ? o : x)));
    setRan((s) => s.map((x, j) => (j === i ? true : x)));
    ranRef.current = ranRef.current.map((x, j) => (j === i ? true : x));
  };

  // Like a notebook's "restart and run to here": if this step (or a later one) already ran,
  // start a fresh session and replay steps 1..i, keeping any edits. Results stay reproducible.
  const freshSession = async (e: Engine) => {
    setBusy(0);
    await e.reset();
    const clear = steps.map(() => false);
    setRan(clear); ranRef.current = clear;
    setOuts(steps.map(() => null));
  };
  const run = async (i: number) => {
    if (busy >= 0) return;
    try {
      const e = await getEngine();
      if (ranRef.current.slice(i).some(Boolean)) await freshSession(e);
      // Steps build on each other: run any earlier step that hasn't run yet
      for (let j = 0; j < i; j++) if (!ranRef.current[j]) await runOne(e, j);
      await runOne(e, i);
    } catch (err) {
      setOuts((s) => s.map((x, j) => (j === i ? { kind: "error", text: "Couldn't load the engine: " + String(err) } : x)));
    } finally { setBusy(-1); }
  };
  const runAll = async () => {
    if (busy >= 0) return;
    try {
      const e = await getEngine();
      if (ranRef.current.some(Boolean)) await freshSession(e);
      for (let j = 0; j < steps.length; j++) { setCur(j); await runOne(e, j); }
    }
    catch (err) { setOuts((s) => s.map((x, j) => (j === 0 ? { kind: "error", text: "Couldn't load the engine: " + String(err) } : x))); }
    finally { setBusy(-1); }
  };
  const reset = async () => {
    if (busy >= 0) return;
    if (eng.current) { const e = await eng.current; await e.reset(); }
    setOuts(steps.map(() => null)); setRan(steps.map(() => false)); setCodes(steps.map((s) => s.code)); setCur(0);
  };

  const s = steps[cur], edited = codes[cur] !== s.code;
  return (
    <div className="runner">
      <div className="run-bar">
        <span className={"run-engine " + status}>
          <i aria-hidden="true" />{ENGINES[engine].label}
          {status === "loading" && <em> · loading…</em>}{status === "ready" && <em> · ready</em>}{status === "failed" && <em> · couldn't load (check your connection)</em>}
        </span>
        <span className="row">
          <button className="btn btn-primary" onClick={runAll} disabled={busy >= 0}>▶ Run all steps</button>
          <button className="btn btn-ghost" onClick={reset} disabled={busy >= 0}>Reset</button>
        </span>
      </div>
      {intro && <p className="small muted" style={{ margin: "0 0 10px" }}>{intro}</p>}
      <div className="run-steps" role="tablist" aria-label="Steps">
        {steps.map((st, k) => (
          <button key={k} role="tab" aria-selected={k === cur} className={(ran[k] ? "done " : "") + (busy === k ? "busy" : "")} onClick={() => setCur(k)} title={st.title}>
            <b>{busy === k ? "…" : ran[k] ? "✓" : k + 1}</b><span>{st.title}</span>
          </button>
        ))}
      </div>
      <div className="run-step">
        <div className="run-head">
          <span className="eyebrow" style={{ margin: 0 }}>Step {cur + 1} of {steps.length}</span>
          <h3>{s.title}</h3>
          <p className="small muted">{s.why}</p>
        </div>
        <div className="split even">
          <div>
            <textarea className="run-code" value={codes[cur]} spellCheck={false} aria-label={`Code for step ${cur + 1}: ${s.title}`}
              rows={Math.min(22, Math.max(5, codes[cur].split("\n").length + 1))}
              onChange={(e) => { const v = e.target.value; setCodes((c) => c.map((x, j) => (j === cur ? v : x))); }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => run(cur)} disabled={busy >= 0}>{busy === cur ? "Running…" : status === "loading" ? "Loading engine…" : `▶ Run step ${cur + 1}`}</button>
              {edited && <button className="btn btn-ghost" onClick={() => setCodes((c) => c.map((x, j) => (j === cur ? s.code : x)))}>Restore original</button>}
              <span className="small muted">You can edit the code before running it.</span>
            </div>
          </div>
          <div aria-live="polite">
            {outs[cur] ? <Out o={outs[cur]!} expectError={s.expectError} />
              : <div className="run-out empty">{status === "loading" ? ENGINES[engine].load : cur > 0 && !ran[cur - 1] ? `Press Run: steps 1–${cur} will run first, because each step builds on the last.` : "Press Run to see the output."}</div>}
            <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0}>← Previous step</button>
              <button className="btn btn-ghost" onClick={() => setCur(Math.min(steps.length - 1, cur + 1))} disabled={cur === steps.length - 1}>Next step →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
