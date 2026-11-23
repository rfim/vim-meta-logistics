import { useEffect, useRef, useState } from "react";
import { Deck, type Slide } from "../components/Deck";
import { R, Sec, tween } from "../components/Bits";

/* Illustrative replay between the measured start (0.20) and end (0.85). Intermediate cycles are not measurements. */
const CYCLES = [0.20, 0.38, 0.52, 0.66, 0.77, 0.85];

function Wheels() {
  const [c, setC] = useState(0);
  const [fit, setFit] = useState(CYCLES[0]);
  const [spin, setSpin] = useState(0);
  const turn = () => {
    const next = c >= CYCLES.length - 1 ? 0 : c + 1;
    tween(fit, CYCLES[next], 900, setFit);
    setC(next);
    setSpin((s) => s + 1);
  };
  const L = { cx: 190, cy: 190 }, Rr = { cx: 530, cy: 190 };
  const rot = spin * 120;
  const ring = (cx: number, cy: number, labels: string[], dir: 1 | -1, title: string) => (
    <g>
      <circle cx={cx} cy={cy} r={130} fill="var(--card)" stroke="var(--line)" strokeWidth={2} />
      <g style={{ transform: `rotate(${dir * rot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform .9s cubic-bezier(.2,.7,.2,1)" }}>
        <circle cx={cx} cy={cy} r={112} fill="none" stroke="var(--act)" strokeWidth={3} strokeDasharray="10 14" opacity={0.6} />
        {labels.map((l, k) => {
          const a = (k / labels.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 112, y = cy + Math.sin(a) * 112;
          return <circle key={l} cx={x} cy={y} r={7} fill="var(--act)" />;
        })}
      </g>
      {labels.map((l, k) => {
        const a = (k / labels.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * 78, y = cy + Math.sin(a) * 78;
        return <text key={l} x={x} y={y + 4} textAnchor="middle" className="sub" style={{ fontSize: 12, fontWeight: 600 }}>{l}</text>;
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" className="lbl" style={{ fontSize: 16 }}>{title}</text>
    </g>
  );
  return (
    <div className="split">
      <div className="diagram-box">
        <svg viewBox="0 0 720 400" className="diagram" role="img" aria-labelledby="fw-t fw-d">
          <title id="fw-t">Two-wheel flywheel: process mining and Claude Code</title>
          <desc id="fw-d">The left wheel is process mining: event log, discover, conform, find the wait. The right wheel is Claude Code: context, draft, human review, feedback. Gaps flow right as context, tests and priorities. Approved fixes flow left as a new log to mine.</desc>
          <defs><marker id="fwa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--act)" }} /></marker></defs>
          {ring(L.cx, L.cy, ["event log", "discover", "conform", "find the wait"], 1, "Process mining")}
          {ring(Rr.cx, Rr.cy, ["context", "draft", "human review", "feedback"], -1, "Claude Code")}
          <path d="M300,120 Q360,70 420,120" fill="none" stroke="var(--act)" strokeWidth={2.5} markerEnd="url(#fwa)" />
          <text x={360} y={78} textAnchor="middle" className="sub" style={{ fontSize: 11 }}>gaps → context, tests,</text>
          <text x={360} y={92} textAnchor="middle" className="sub" style={{ fontSize: 11 }}>Multica priorities</text>
          <path d="M420,262 Q360,312 300,262" fill="none" stroke="var(--act)" strokeWidth={2.5} markerEnd="url(#fwa)" />
          <text x={360} y={318} textAnchor="middle" className="sub" style={{ fontSize: 11 }}>approved fix → new log</text>
          <text x={360} y={385} textAnchor="middle" className="sub" style={{ fontSize: 11 }}>A person approves every change before it ships.</text>
        </svg>
      </div>
      <div className="card" aria-live="polite">
        <span className="eyebrow">Cycle {c + 1} of {CYCLES.length}</span>
        <div className="kpi">
          <div className="k">Process fitness <b className={fit >= 0.8 ? "good" : "bad"}>{fit.toFixed(2)}</b></div>
          <div className={"meter" + (fit < 0.8 ? " bad" : "")}><i style={{ width: `${fit * 100}%` }} /></div>
        </div>
        <button className="btn btn-primary mt" onClick={turn}>{c >= CYCLES.length - 1 ? "Replay from the start" : "Turn the flywheel"}</button>
        <p className="small muted mt">Measured at Crea Digital Ventures: <b>0.20 → 0.85</b>. The cycles in between are an <b>illustrative replay</b>, not measurements.</p>
      </div>
    </div>
  );
}

/* Review notes become rules in the next prompt */
const NOTES = [
  { pr: "#41", note: "Auto-approve skipped the audit event on retries.", rule: "Every automated decision writes an audit event, retries included." },
  { pr: "#44", note: "Fix looked great on average, but one site didn't move.", rule: "Check per-site impact before claiming an average." },
  { pr: "#47", note: "Test data reused production supplier names.", rule: "Use synthetic fixtures only; never copy production names into tests." },
];
function Rules() {
  const [n, setN] = useState(0);
  return (
    <div className="split even">
      <div className="grid" style={{ alignContent: "start" }}>
        {NOTES.map((x, k) => (
          <div key={x.pr} className="card flat" style={{ opacity: k < n ? 0.55 : 1 }}>
            <span className="eyebrow">Review note on PR {x.pr}</span>
            <p className="small" style={{ margin: 0 }}>“{x.note}”</p>
          </div>
        ))}
        <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => setN(n >= NOTES.length ? 0 : n + 1)}>
          {n >= NOTES.length ? "Start over" : `Turn note ${n + 1} into a rule →`}
        </button>
      </div>
      <pre className="prompt after" tabIndex={0} aria-live="polite">{`## Constraints  (rules from past review notes)
- Never auto-approve a part class that isn't on the allow-list.
${NOTES.slice(0, n).map((x) => `- ${x.rule}   ← from ${x.pr}`).join("\n")}${n === 0 ? "\n(new rules appear here as reviews land)" : ""}`}</pre>
    </div>
  );
}

/* Multica-style agent board */
type Ticket = { id: string; t: string; col: number; human?: boolean };
const COLS = ["Mined gap", "Prioritised (Multica)", "Claude Code drafting", "Human review", "Merged", "Re-mined ✓"];
const START: Ticket[] = [
  { id: "G-12", t: "Approve waits 31 h on spares", col: 0 },
  { id: "G-13", t: "Rework loop: mismatch at dock", col: 0 },
  { id: "G-14", t: "Pick with no approval event", col: 1 },
  { id: "G-09", t: "Duplicate supplier records", col: 3, human: true },
  { id: "G-07", t: "Lot not recorded at receive", col: 4 },
];
function Board() {
  const [tk, setTk] = useState(START);
  const [play, setPlay] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!play) return;
    timer.current = window.setInterval(() => {
      setTk((all) => {
        // advance one ticket that isn't blocked on a human
        const mv = [...all].sort((a, b) => b.col - a.col).find((x) => x.col < COLS.length - 1 && x.col !== 3);
        if (!mv) return all;
        return all.map((x) => x.id === mv.id ? { ...x, col: x.col + 1, human: x.col + 1 === 3 } : x);
      });
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 400 : 1100);
    return () => clearInterval(timer.current);
  }, [play]);
  const approve = (id: string) => setTk((all) => all.map((x) => x.id === id ? { ...x, col: 4, human: false } : x));
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setPlay(!play)} aria-pressed={play}>{play ? "Pause the agents" : "Run the agents"}</button>
        <button className="btn btn-ghost" onClick={() => { setPlay(false); setTk(START); }}>Reset</button>
        <span className="small muted">Agents move tickets on their own, but nothing leaves Human review until you press Approve.</span>
      </div>
      <div className="board" role="region" aria-label="Agent board" tabIndex={0}>
        {COLS.map((c, k) => (
          <div className="col" key={c}>
            <h4>{c}<span>{tk.filter((x) => x.col === k).length}</span></h4>
            {tk.filter((x) => x.col === k).map((x) => (
              <div key={x.id} className={"ticket" + (k === 3 ? " human" : "")}>
                <b>{x.id}</b>{x.t}
                <div className="who">{k <= 1 ? "from the miner" : k === 2 ? "agent: Claude Code" : k === 3 ? "waiting for a person" : k === 4 ? "approved" : "fitness re-checked"}</div>
                {k === 3 && <button className="btn btn-primary" style={{ padding: "6px 12px", marginTop: 8, fontSize: ".8rem" }} onClick={() => approve(x.id)}>Approve</button>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="small muted mt">Ticket names and counts are illustrative. At Crea, <b>85%</b> of agent-drafted fix PRs merged after review.</p>
    </>
  );
}

/* Before/after impact, before = 100 */
const IMPACT: [string, number, number, string][] = [
  ["Rule breaches", 100, 20, "−80%"], ["Bottleneck wait", 100, 35, "−65%"], ["Rework", 100, 50, "−50%"],
  ["Cycle time", 100, 60, "−40%"], ["Log preparation time", 100, 25, "−75%"], ["Cases per team", 100, 165, "+65%"],
  ["First-pass acceptance", 50, 85, "50% → 85%"], ["Process fitness (×100)", 20, 85, "0.20 → 0.85"],
];
function Impact({ on }: { on: boolean }) {
  return (
    <div className="bars" role="list">
      {IMPACT.map(([l, b, a, v]) => (
        <div className="bar-row" role="listitem" key={l} aria-label={`${l}: ${v}`}>
          <span className="lab">{l}</span>
          <span className="pair" aria-hidden="true">
            <span className="bar before"><i style={{ width: on ? `${(b / 165) * 100}%` : 0 }} /></span>
            <span className="bar after"><i style={{ width: on ? `${(a / 165) * 100}%` : 0 }} /></span>
          </span>
          <span className="val">{v}</span>
        </div>
      ))}
    </div>
  );
}
function ImpactSlide() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setOn(true); });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref}><Impact on={on} /><div className="legend"><span><i style={{ background: "var(--bad)" }} />before</span><span><i style={{ background: "var(--act)" }} />after</span></div></div>;
}

const slides: Slide[] = [
  {
    id: "top", label: "Two wheels",
    body: <Sec eyebrow="The flywheel" title="Process mining ↔ Claude Code" id="w" lead="Each wheel makes the other better. Mining tells Claude Code exactly where and what to fix. Claude Code's approved fixes produce a new log, and mining proves whether they worked."><Wheels /></Sec>,
  },
  {
    id: "prompt", label: "Before / after prompt",
    body: (
      <Sec tone="alt" eyebrow="Context engineering" title="“Speed up approvals” vs a mined context pack" id="p">
        <div className="grid g2">
          <R i={0}><h3>Before</h3><pre className="prompt before" tabIndex={0}>speed up approvals</pre>
            <p className="small muted mt">No location, no size, no definition of done. The agent has to guess, and so does the reviewer.</p></R>
          <R i={1}><h3>After</h3><pre className="prompt after" tabIndex={0}>{`## Context (mined)
Bottleneck: "approve", median wait 31 h (target 8 h)
Rework: 24% loop ship → mismatch → pick
Fitness: 0.20  (m=400 c=500 r=400 p=500)

## Constraints (rules from review notes)
- Allow-list only; audit every auto-approval
- Per-site flag; rollback = flag off

## Acceptance tests (from mined variants)
1. Happy path still passes
2. Bottleneck cases: median wait ≤ 11 h
3. Re-mined fitness ≥ 0.80`}</pre></R>
        </div>
        <R i={2} className="row mt"><a className="btn btn-primary" href="mining.html#prompt">See it written live from the simulation →</a></R>
      </Sec>
    ),
  },
  { id: "rules", label: "Notes → rules", body: <Sec eyebrow="Feedback that compounds" title="Review notes become rules in the next prompt." id="r" lead="Every review comment that would have caught a bug becomes a standing constraint. The next draft starts from everything the last review learned."><Rules /></Sec> },
  { id: "board", label: "Agent board", body: <Sec tone="alt" eyebrow="Agent orchestration" title="A Multica-style board, with a person in the loop." id="b"><Board /></Sec> },
  { id: "impact", label: "Impact", body: <Sec eyebrow="Before and after · Fettle at Crea Digital Ventures" title="What the flywheel changed." id="i" lead="Measured results; the before value is indexed to 100 unless stated."><ImpactSlide /></Sec> },
];

export function Flywheel() { return <Deck slides={slides} />; }
