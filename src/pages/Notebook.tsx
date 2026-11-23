import { useState, type ReactNode } from "react";
import { Deck, type Slide } from "../components/Deck";
import { Syn } from "../components/Chrome";
import { Sec, fitness } from "../components/Bits";

/* A real "Run all" workspace: everything below is computed in the browser from a seeded synthetic log. */
type Ev = { case: number; act: string; t: number; site: string };
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

function makeLog(n = 1000): Ev[] {
  const r = rng(42), log: Ev[] = [], sites = ["DC-A", "DC-B", "DC-C"];
  for (let c = 1; c <= n; c++) {
    const site = sites[Math.floor(r() * 3)];
    let t = c * 0.7;
    const push = (act: string, wait: number) => { t += wait; log.push({ case: c, act, t: +t.toFixed(2), site }); };
    push("request", 0);
    const v = r();
    if (v > 0.93) { push("pick", 2); push("ship", 3); push("receive", 18); continue; }        // breach: no approval
    push("approve", v < 0.32 ? 24 + r() * 30 : 2 + r() * 10);                                   // bottleneck
    if (v > 0.89) { push("cancelled", 4); continue; }
    push("pick", 2 + r() * 3); push("ship", 2 + r() * 2);
    if (r() < 0.16) { push("mismatch", 20); push("pick", 3); push("ship", 2); }               // rework
    push("receive", 18 + r() * 8);
  }
  return log;
}
const traces = (log: Ev[]) => { const m = new Map<number, Ev[]>(); log.forEach((e) => (m.get(e.case) || m.set(e.case, []).get(e.case)!).push(e)); return [...m.values()]; };

// Token replay on the sequential net: start →request→ p1 →approve→ p2 →pick→ p3 →ship→ p4 →receive→ end
const MODEL: Record<string, [string, string]> = { request: ["start", "p1"], approve: ["p1", "p2"], pick: ["p2", "p3"], ship: ["p3", "p4"], receive: ["p4", "end"] };
function replay(ts: Ev[][]) {
  let m = 0, c = 0, r = 0, p = 0;
  for (const tr of ts) {
    const mk: Record<string, number> = { start: 1 }; p++;
    for (const e of tr) {
      const tr2 = MODEL[e.act]; if (!tr2) continue;
      const [i, o] = tr2;
      if (!mk[i]) { m++; mk[i] = 1; }
      mk[i]--; c++; mk[o] = (mk[o] || 0) + 1; p++;
    }
    if (!mk.end) { m++; mk.end = 1; }
    mk.end--; c++;
    r += Object.values(mk).reduce((a, b) => a + b, 0);
  }
  return { m, c, r, p };
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

type Cell = { src: string; run: (ctx: Record<string, unknown>) => ReactNode };
const CELLS: Cell[] = [
  { src: `// 1 · Load a synthetic event log (seeded, 1,000 spares requests)
const log = makeLog(1000);
log.slice(0, 6);`,
    run: (ctx) => { const log = makeLog(1000); ctx.log = log; return <Tbl head={["case", "activity", "t (h)", "site"]} rows={log.slice(0, 6).map((e) => [e.case, e.act, e.t, e.site])} note={`${log.length.toLocaleString("en-GB")} events`} />; } },
  { src: `// 2 · Discover the directly-follows graph
count pairs (a → b) within each case`,
    run: (ctx) => {
      const ts = traces(ctx.log as Ev[]); ctx.ts = ts;
      const df = new Map<string, number>();
      ts.forEach((tr) => tr.slice(1).forEach((e, k) => { const key = tr[k].act + " → " + e.act; df.set(key, (df.get(key) || 0) + 1); }));
      return <Tbl head={["edge", "count"]} rows={[...df].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])} bad={(row) => /mismatch|request → pick/.test(String(row[0]))} />;
    } },
  { src: `// 3 · Median wait before each step (hours)
wait = t(event) − t(previous event)`,
    run: (ctx) => {
      const w: Record<string, number[]> = {};
      (ctx.ts as Ev[][]).forEach((tr) => tr.slice(1).forEach((e, k) => (w[e.act] ||= []).push(e.t - tr[k].t)));
      const rows = Object.entries(w).map(([a, v]) => [a, +median(v).toFixed(1)] as [string, number]).sort((a, b) => b[1] - a[1]);
      const max = rows[0][1];
      return <div className="bars">{rows.map(([a, v]) => (
        <div className="bar-row" key={a}><span className="lab">{a}</span><span className={"bar " + (a === "approve" ? "before" : "after")}><i style={{ width: `${(v / max) * 100}%` }} /></span><span className="val">{v} h</span></div>
      ))}</div>;
    } },
  { src: `// 4 · Token replay against the model
fitness = ½(1 − m/c) + ½(1 − r/p)`,
    run: (ctx) => {
      const o = replay(ctx.ts as Ev[][]);
      const f = fitness(o.m, o.c, o.r, o.p);
      return <><Tbl head={["m", "c", "r", "p", "fitness"]} rows={[[o.m, o.c, o.r, o.p, f.toFixed(3)]]} />
        <p className="small muted">Computed on this synthetic log. Missing tokens come from skipped approvals and the rework pick; remaining tokens come from the extra ship. Fettle's real ERP process started at 0.20.</p></>;
    } },
  { src: `// 5 · Reorder point at DC-C, 95% service level
ROP = μL + zσ√L   (z = 1.645)`,
    run: () => {
      const parts: [string, number, number, number][] = [["SSD 3.84 TB", 8.9, 3.6, 12], ["DIMM 64 GB", 11.2, 4.1, 7], ["PSU 2 kW", 1.9, 1.1, 14], ["NIC 100G", 1.2, 0.8, 21], ["Fan module", 3.8, 1.5, 5]];
      return <Tbl head={["part", "μ", "σ", "L", "ROP"]} rows={parts.map(([n, mu, s, L]) => [n, mu, s, L, Math.ceil(mu * L + 1.645 * s * Math.sqrt(L))])} />;
    } },
  { src: `// 6 · FIFO pick of 50 units across lots, oldest first`,
    run: () => {
      const lots: [string, number][] = [["L-2407-118", 24], ["L-2408-031", 40], ["L-2409-207", 40], ["L-2410-115", 60]];
      let left = 50;
      return <Tbl head={["lot", "on hand", "pick"]} rows={lots.map(([l, q]) => { const p = Math.max(0, Math.min(q, left)); left -= p; return [l, q, p || "–"]; })} />;
    } },
];

function Tbl({ head, rows, note, bad }: { head: string[]; rows: (string | number)[][]; note?: string; bad?: (r: (string | number)[]) => boolean }) {
  return (<>
    <div className="table-wrap"><table>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, k) => <tr key={k} className={bad?.(r) ? "below" : ""}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{v}</td>)}</tr>)}</tbody>
    </table></div>
    {note && <p className="small muted" style={{ marginTop: 6 }}>{note}</p>}
  </>);
}

function Workspace() {
  const [out, setOut] = useState<(ReactNode | null)[]>(CELLS.map(() => null));
  const [count, setCount] = useState<(number | null)[]>(CELLS.map(() => null));
  const [busy, setBusy] = useState(-1);
  const [n, setN] = useState(0);
  const runAll = async () => {
    const ctx: Record<string, unknown> = {};
    const slow = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    let k = n;
    for (let i = 0; i < CELLS.length; i++) {
      setBusy(i);
      if (slow) await new Promise((r) => setTimeout(r, 350));
      const o = CELLS[i].run(ctx);
      k++;
      const kk = k;
      setOut((s) => s.map((x, j) => (j === i ? o : x)));
      setCount((s) => s.map((x, j) => (j === i ? kk : x)));
    }
    setN(k); setBusy(-1);
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={runAll} disabled={busy >= 0}>▶ Run all</button>
        <button className="btn btn-ghost" onClick={() => { setOut(CELLS.map(() => null)); setCount(CELLS.map(() => null)); }}>Clear outputs</button>
        <Syn />
      </div>
      {CELLS.map((c, i) => (
        <div key={i} className={"cell" + (busy === i ? " running" : "")}>
          <div className="gut" aria-hidden="true">[{busy === i ? "*" : count[i] ?? " "}]</div>
          <div>
            <pre className="src" tabIndex={0}>{c.src}</pre>
            <div className="out" aria-live="polite">{out[i]}</div>
          </div>
        </div>
      ))}
    </>
  );
}

const slides: Slide[] = [
  { id: "top", label: "Workspace", body: <Sec eyebrow="Notebook · runs in your browser" title="Run all." id="nb" lead="The whole method in six cells: load a log, discover the flow, find the wait, measure fitness, size the spares, pick FIFO. Every output is computed live from a seeded synthetic log."><Workspace /></Sec> },
  {
    id: "about", label: "About this notebook",
    body: (
      <Sec tone="alt" eyebrow="About" title="Why a notebook?" id="ab">
        <div className="grid g2">
          <div className="card"><p className="muted">It's how I work with a team on a new flow: one shared place where the log, the mined net and the numbers live together, so a planner and an engineer can read the same cell and agree on what it says.</p></div>
          <div className="card"><p className="muted">The cells are TypeScript running in the page, so nothing is pre-baked. Re-run them and you get the same numbers, because the log is seeded.</p></div>
        </div>
      </Sec>
    ),
  },
];

export function Notebook() { return <Deck slides={slides} />; }
