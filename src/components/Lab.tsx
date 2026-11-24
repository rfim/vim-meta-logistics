import { useMemo, useState } from "react";
import { PetriNet } from "./PetriNet";
import { HARNESS, SOURCES, discoverNet, generate, mine, prompts, type Harness, type SourceId } from "../lib/lab";

const STEPS = ["Extract", "Event log", "Discover", "Find the wait", "Prompt", "Fix & re-mine", "Workflow"];
const h1 = (x: number) => x.toFixed(1);
const pct = (x: number) => Math.round(x * 100) + "%";

function Table({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, k) => <tr key={k}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{v}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

/** Process Lab: pick an ERP (or the Meta data-centre flow), mine it, simulate the discovered net,
 *  write the prompt for your agent harness, apply the fix and re-mine. */
export function Lab({ initial = "metadc", sources = ["metadc", "sap", "oracle", "odoo"] }: { initial?: SourceId; sources?: SourceId[] }) {
  // A hero shortcut like "?try=sap#lab" opens the Lab on that source
  const [sid, setSid] = useState<SourceId>(() => {
    const q = new URLSearchParams(location.search).get("try") as SourceId | null;
    return q && sources.includes(q) ? q : initial;
  });
  const [harness, setHarness] = useState<Harness>("claude");
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState(0);
  const [ptab, setPtab] = useState(1);
  const [copied, setCopied] = useState(false);

  const src = SOURCES[sid];
  const r = useMemo(() => {
    const log = generate(src), m = mine(src, log);
    const fixedLog = generate(src, 400, true), fx = mine(src, fixedLog);
    const net = discoverNet(src, m);
    return { log, m, fx, net, before: net.config(), after: net.config(fx), raw: src.tables(log) };
  }, [src]);
  const p = useMemo(() => prompts(src, r.m, harness), [src, r.m, harness]);
  const choose = (s: SourceId) => { setSid(s); setTab(0); };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ } };
  const b = r.m.bottleneck, a = r.fx.bottleneck;

  return (
    <div className="lab">
      <div className="lab-bar">
        <div className="lab-try" role="group" aria-label="Try with a data source">
          <span className="lab-label">Try with</span>
          {sources.map((s) => (
            <button key={s} className={"lab-chip" + (s === sid ? " on" : "")} aria-pressed={s === sid} onClick={() => choose(s)}>
              {SOURCES[s].label}{s === "metadc" ? <small> synthetic</small> : <small> data</small>}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Agent harness">
          {(Object.keys(HARNESS) as Harness[]).map((h) => <button key={h} aria-pressed={h === harness} onClick={() => setHarness(h)}>{HARNESS[h].label}</button>)}
        </div>
      </div>
      <p className="small muted" style={{ margin: "0 0 10px" }}>{src.system} · {src.flow} · {r.m.cases} cases, {r.m.events.toLocaleString("en-GB")} events. {src.synthetic}</p>

      <div className="run-steps" role="tablist" aria-label="Lab steps">
        {STEPS.map((s, k) => (
          <button key={s} role="tab" aria-selected={k === step} className={k < step ? "done" : ""} onClick={() => setStep(k)}><b>{k < step ? "✓" : k + 1}</b><span>{s}</span></button>
        ))}
      </div>

      <div className="run-step lab-pane" aria-live="polite">
        {step === 0 && (<>
          <h3>1 · Extract from {src.system}</h3>
          <p className="small muted">The {src.flow} trail is spread across tables. These are the first rows of each, shaped like the real ones.</p>
          <div className="seg" role="tablist" aria-label="Tables">{r.raw.map((t, k) => <button key={t.name} role="tab" aria-selected={k === tab} onClick={() => setTab(k)}>{t.name}</button>)}</div>
          <p className="small muted mt" style={{ marginBottom: 6 }}><code>{r.raw[tab].name}</code>: {r.raw[tab].note}</p>
          <Table cols={r.raw[tab].cols} rows={r.raw[tab].rows} />
        </>)}

        {step === 1 && (<>
          <h3>2 · Map it to one event log</h3>
          <p className="small muted">Process mining needs three columns: case, activity, timestamp. One query maps {src.system} onto them.</p>
          <div className="split even">
            <pre className="code" tabIndex={0} style={{ maxHeight: "44vh" }}>{src.mapping}</pre>
            <div>
              <Table cols={["case", "activity", "timestamp", "site"]} rows={r.log.slice(0, 9).map((e) => [e.c, e.a, new Date(Date.UTC(2026, 9, 1) + e.t * 3600e3).toISOString().slice(0, 16).replace("T", " "), e.site])} />
              <p className="small muted" style={{ marginTop: 6 }}>{r.m.events.toLocaleString("en-GB")} events across {r.m.cases} cases.</p>
            </div>
          </div>
        </>)}

        {step === 2 && (<>
          <h3>3 · Discover the process, then simulate it</h3>
          <p className="small muted">The Petri net below was built from the log: the most common path runs left to right, and exceptions sit underneath. Each dot is a case moving at the speed the log says it moves. Red dashed arcs are rework or skipped steps.</p>
          <div className="diagram-box no-swipe"><PetriNet key={"b" + sid} spec={r.net.spec} config={r.before} hot={r.net.hot} /></div>
          <div className="grid g2 mt">
            <Table cols={["variant", "cases"]} rows={r.m.variants.slice(0, 4).map((v) => [v.v.join(" → "), v.n])} />
            <Table cols={["a → b (directly follows)", "count"]} rows={r.m.edges.slice(0, 6).map((e) => [`${e.a} → ${e.b}`, e.n])} />
          </div>
        </>)}

        {step === 3 && (<>
          <h3>4 · Find where the work waits</h3>
          <div className="split">
            <div className="bars">
              {r.m.waits.filter((w) => w.a !== r.m.order[0]).map((w) => {
                const max = Math.max(...r.m.waits.map((x) => x.p75));
                const isB = w.a === b.a, isT = src.transit.includes(w.a);
                return (
                  <div className="bar-row" key={w.a}>
                    <span className="lab">{w.a}{isT ? <small className="muted"> · transit</small> : isB ? <small style={{ color: "var(--bad)" }}> · bottleneck</small> : null}</span>
                    <span className={"bar " + (isB ? "before" : "after")}><i style={{ width: `${(w.p75 / max) * 100}%` }} /></span>
                    <span className="val">{h1(w.p75)} h</span>
                  </div>
                );
              })}
              <p className="small muted">p75 wait before each step. Transit time (the truck) is not a queue, so it can't be the bottleneck.</p>
            </div>
            <div className="card flat">
              <div className="kpi">
                <div className="k">Bottleneck <b className="bad">{b.a}</b></div>
                <div className="k">Median / p75 wait <b className="bad">{h1(b.med)} / {h1(b.p75)} h</b></div>
                <div className="k">Cases waiting &gt; 24 h <b className="bad">{pct(b.over24)}</b></div>
                {src.def.rework && <div className="k">Rework via “{src.def.rework.via}” <b>{pct(r.m.rework)}</b></div>}
                {src.def.skip && <div className="k">Rule breaches (no “{src.def.skip.a}”) <b>{pct(r.m.breach)}</b></div>}
                <div className="k">Fitness ½(1−m/c)+½(1−r/p) <b>{r.m.fit.f.toFixed(2)}</b></div>
              </div>
              <p className="small muted mt" style={{ marginBottom: 4 }}>Bias check, median wait per site:</p>
              <Table cols={["site", `median wait before ${b.a}`]} rows={r.m.bySite.map((s) => [s.site, h1(s.med) + " h"])} />
            </div>
          </div>
        </>)}

        {step === 4 && (<>
          <h3>5 · The prompt, written from what was mined, for {HARNESS[harness].label}</h3>
          <p className="small muted">{HARNESS[harness].note} Switch harness at the top. The facts, rules and tests stay the same; only the packaging changes.</p>
          <div className="split even">
            <div>
              <p className="eyebrow" style={{ color: "var(--bad)" }}>Before: the usual one-liner</p>
              <pre className="prompt before" tabIndex={0}>{p.before}</pre>
              <ul className="small muted mt">
                <li><b>Located:</b> names the step and the size of the wait, per site.</li>
                <li><b>Bounded:</b> rules from past reviews stop the agent guessing.</li>
                <li><b>Testable:</b> acceptance tests come from real variants.</li>
                <li><b>Safe:</b> plan first, feature flag, a person approves.</li>
              </ul>
            </div>
            <div>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <div className="seg" role="tablist" aria-label="Prompt files">{p.files.map((f, k) => <button key={f.name} role="tab" aria-selected={k === ptab} onClick={() => setPtab(k)}>{f.name}</button>)}</div>
                <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => copy(p.files[Math.min(ptab, p.files.length - 1)].body)}>{copied ? "Copied ✓" : "Copy"}</button>
              </div>
              <pre className="prompt after" tabIndex={0} style={{ maxHeight: "46vh", overflow: "auto" }}>{p.files[Math.min(ptab, p.files.length - 1)].body}</pre>
            </div>
          </div>
        </>)}

        {step === 5 && (<>
          <h3>6 · Apply the approved fix, then mine again</h3>
          <p className="small muted"><b>The fix:</b> {src.fixWhat} It is simulated on the same synthetic flow, and a person approves it first.</p>
          <div className="diagram-box no-swipe"><PetriNet key={"a" + sid} spec={r.net.spec} config={r.after} hot={[]} /></div>
          <div className="mt">
            <Table cols={["measure", "before", "after"]} rows={[
              [`p75 wait before ${b.a}`, h1(b.p75) + " h", h1(a.p75) + " h"],
              ["cases waiting > 24 h", pct(b.over24), pct(a.over24)],
              ...(src.def.rework ? [[`rework via ${src.def.rework.via}`, pct(r.m.rework), pct(r.fx.rework)]] : []),
              ...(src.def.skip ? [["rule breaches", pct(r.m.breach), pct(r.fx.breach)]] : []),
              ["fitness", r.m.fit.f.toFixed(2), r.fx.fit.f.toFixed(2)],
            ] as (string | number)[][]} />
            <p className="small muted" style={{ marginTop: 6 }}>Simulated on synthetic data. Fettle's measured results at Crea Digital Ventures: bottleneck wait −65%, rework −50%, fitness 0.20 → 0.85.</p>
          </div>
        </>)}

        {step === 6 && (<>
          <h3>7 · How it changes the agent's workflow ({HARNESS[harness].label})</h3>
          <div className="split even">
            <ol className="flow-list bad">
              <li><b>Vague prompt.</b> “{p.before}”. The agent searches the code for “approval” and guesses.</li>
              <li><b>Generic draft.</b> A faster screen, a cache, a retry: nothing tied to the step that waits.</li>
              <li><b>Review, round 1.</b> “Which step? Which sites? How will we know it worked?”</li>
              <li><b>Tests written after</b> the code, to fit what was built.</li>
              <li><b>Rounds 2 and 3.</b> The same questions, answered by hand.</li>
              <li><b>Merged without proof</b> that the wait moved.</li>
            </ol>
            <ol className="flow-list good">
              <li><b>Mined context in.</b> The agent reads {HARNESS[harness].memory} rules and the facts: “{b.a}”, p75 {h1(b.p75)} h, per site.</li>
              <li><b>Plan first.</b> A plan scoped to “{b.a}”; a person approves the plan before any edit.</li>
              <li><b>Draft against tests</b> generated from the real variants.</li>
              <li><b>Tests pass</b>, and the PR carries the per-site table.</li>
              <li><b>One review.</b> The reviewer's note becomes a rule; the approved fix becomes an example.</li>
              <li><b>Re-mined:</b> p75 {h1(b.p75)} h → {h1(a.p75)} h on this sample. The loop turns again.</li>
            </ol>
          </div>
          <p className="small muted mt">The workflow on the left is illustrative. Measured at Crea Digital Ventures with Fettle: first-pass acceptance rose from 50% to 85%, and 85% of agent-drafted fix PRs merged after review.</p>
        </>)}

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button>
          <button className="btn btn-primary" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>Next: {STEPS[Math.min(STEPS.length - 1, step + 1)]} →</button>
        </div>
      </div>
    </div>
  );
}
