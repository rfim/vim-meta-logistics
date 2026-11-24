import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Slide } from "./Deck";
import { Sec, tween } from "./Bits";
import { Orbit, type Style } from "./Orbit";

/* Illustrative replay between the measured start (0.20) and end (0.85). Intermediate cycles are not measurements. */
const CYCLES = [0.20, 0.38, 0.52, 0.66, 0.77, 0.85];

export function Wheels({ extra }: { extra?: ReactNode } = {}) {
  const [c, setC] = useState(0);
  const [fit, setFit] = useState(CYCLES[0]);
  const [laps, setLaps] = useState(0);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<Style>(() => {
    const q = new URLSearchParams(location.search).get("style");
    return q === "ring" || q === "track" || q === "eight" ? q : "eight";
  });
  const turn = () => { if (busy) return; setBusy(true); setLaps((n) => n + 1); };
  // Recording hook for preview frames: set fitness and cycle directly
  useEffect(() => { (window as unknown as { __flySet?: (f: number, c: number) => void }).__flySet = (f, k) => { setFit(f); setC(k); }; }, []);
  const onLap = () => {
    const next = c >= CYCLES.length - 1 ? 0 : c + 1;
    tween(fit, CYCLES[next], 900, setFit);
    setC(next); setBusy(false);
  };
  return (
    <div className="split">
      <div className="diagram-box no-swipe">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="seg" role="tablist" aria-label="Flywheel style">
            {([["eight", "Figure-eight"], ["ring", "Single orbit"], ["track", "Loop track"]] as [Style, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={style === k} onClick={() => setStyle(k)} disabled={busy}>{l}</button>
            ))}
          </div>
        </div>
        <Orbit style={style} laps={laps} fit={fit} onLap={onLap} />
      </div>
      <div className="card" aria-live="polite">
        <span className="eyebrow">Cycle {c + 1} of {CYCLES.length}</span>
        <div className="kpi">
          <div className="k">Process fitness <b className={fit >= 0.8 ? "good" : "bad"}>{fit.toFixed(2)}</b></div>
          <div className={"meter" + (fit < 0.8 ? " bad" : "")}><i style={{ width: `${fit * 100}%` }} /></div>
        </div>
        <button className="btn btn-primary mt" onClick={turn} disabled={busy}>{busy ? "Turning…" : c >= CYCLES.length - 1 ? "Replay from the start" : "Turn the flywheel"}</button>
        <p className="small muted mt">Measured at Crea Digital Ventures: <b>0.20 → 0.85</b>. The cycles in between are an <b>illustrative replay</b>, not measurements.</p>
        {extra}
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
export function Rules() {
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
export function Board() {
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
export function ImpactSlide() {
  // Bars always carry their final width; CSS grows them in when the slide becomes active.
  return <div><Impact on={true} /><div className="legend"><span><i style={{ background: "var(--bad)" }} />before</span><span><i style={{ background: "var(--act)" }} />after</span></div></div>;
}

const STEPS: [string, string][] = [["simulate", "Mine"], ["fitness", "Measure"], ["prompt", "Prompt"], ["board", "Agents draft"], ["gate", "Human gate"], ["remine", "Re-mine"], ["rules", "Learn"]];

export const processMapSlide: Slide = {
  id: "flywheel", label: "The process",
  body: (
    <Sec eyebrow="The Fettle process · one loop, seven steps" title="Process mining ↔ Claude Code" id="w"
      lead="Each wheel makes the other better. Mining tells Claude Code exactly where and what to fix, a person approves, and mining proves whether it worked. Turn the flywheel, then walk the seven steps.">
      <Wheels extra={
        <nav className="steps7" aria-label="The seven steps">
          <span className="eyebrow" style={{ margin: "4px 0 2px", width: "100%" }}>Walk the seven steps</span>
          {STEPS.map(([id, l], k) => <a key={id} href={"#" + id}><b>{k + 1}</b>{l}</a>)}
        </nav>
      } />
    </Sec>
  ),
};
export const boardSlide: Slide = {
  id: "board", label: "Agents draft",
  body: <Sec tone="alt" eyebrow="Step 4 of 7 · Agents draft: Multica priorities, Claude Code drafts" title="A Multica-style board, with a person in the loop." id="b"
    lead="The mined gaps become prioritised tickets. Claude Code drafts a fix for each, and every draft stops at Human review."><Board /><div className="row mt"><a className="btn btn-primary" href="#gate">Gate the drafted fix →</a></div></Sec>,
};
export const rulesSlide: Slide = {
  id: "rules", label: "Learn",
  body: <Sec eyebrow="Step 7 of 7 · Learn: the feedback loop" title="Review notes become rules in the next prompt." id="r"
    lead="Every review comment that would have caught a bug becomes a standing constraint, and every approved fix becomes an example. The next draft starts from everything the last review learned. Then the loop turns again."><Rules /><div className="row mt"><a className="btn btn-primary" href="#results">See the results →</a><a className="btn btn-ghost" href="#flywheel">Back to the top of the loop</a></div></Sec>,
};
