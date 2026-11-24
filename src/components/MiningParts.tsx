import { useEffect, useMemo, useRef, useState } from "react";
import type { Slide } from "./Deck";
import { Syn } from "./Chrome";
import { Formula, R, Sec, fitness, tween } from "./Bits";
import { PetriNet } from "./PetriNet";
import type { PetriApi, PetriSpec, SimConfig } from "../lib/petri";

/* ---------------- The net: request → approve → pick → ship → receive (synthetic sample) ---------------- */
const SPEC: PetriSpec = {
  title: "Petri net of a spares request: request, approve, pick, ship, receive",
  desc: "Places and transitions in sequence. Approve is the bottleneck, marked red. A dashed red rework arc goes from in transit back to ready to pick. After the Fettle fix, an auto-approve step runs beside Approve.",
  vw: 150,
  nodes: {
    s: { type: "p", label: "raised" }, req: { type: "t", label: "Request" },
    p1: { type: "p", label: "awaiting approval" }, app: { type: "t", label: "Approve", sub: "manual" },
    auto: { type: "t", label: "Auto-approve", sub: "within agreed limits" },
    p2: { type: "p", label: "ready to pick" }, pick: { type: "t", label: "Pick", sub: "scan to confirm" },
    p3: { type: "p", label: "picked" }, ship: { type: "t", label: "Ship" },
    p4: { type: "p", label: "in transit" }, rcv: { type: "t", label: "Receive" },
    re: { type: "t", label: "Mismatch", sub: "back to pick" },
    e: { type: "p", label: "received" },
  },
  layouts: {
    h: { w: 1060, h: 320, nodes: { s: [30, 160], req: [130, 160], p1: [230, 160], app: [330, 160], auto: [330, 60], p2: [430, 160], pick: [530, 160], p3: [630, 160], ship: [730, 160], p4: [830, 160], rcv: [930, 160], re: [630, 270], e: [1030, 160] } },
    v: { w: 360, h: 880, nodes: { s: [100, 30], req: [100, 110], p1: [100, 190], app: [100, 270], auto: [275, 270], p2: [100, 350], pick: [100, 430], p3: [100, 510], ship: [100, 590], p4: [100, 670], rcv: [100, 750], re: [275, 590], e: [100, 830] } },
  },
  arcs: [
    ["s", "req"], ["req", "p1"], ["p1", "app"], ["app", "p2"], ["p2", "pick"], ["pick", "p3"], ["p3", "ship"], ["ship", "p4"], ["p4", "rcv"], ["rcv", "e"],
    ["p4", "re", "rework", { h: -30, v: 30 }], ["re", "p2", "rework", { h: -40, v: 40 }],
    ["p1", "auto", "fix"], ["auto", "p2", "fix"],
  ],
  hidden: ["auto", "p1>auto", "auto>p2"],
};
const BASE = ["s", "req", "p1", "app", "p2", "pick", "p3", "ship", "p4"], TAIL = ["rcv", "e"], LOOP = ["re", "p2", "pick", "p3", "ship", "p4"];
const BEFORE: SimConfig = {
  spawnEvery: .55, speed: 170, lateAt: "p1",
  dwell: { p1: 3.2, p2: .25, p3: .2, p4: .3, req: .2, app: .25, pick: .2, ship: .2, rcv: .2, re: .3 },
  route: () => BASE.concat(Math.random() < .24 ? LOOP : [], TAIL),
};
const AFTER: SimConfig = {
  spawnEvery: .55, speed: 170, lateAt: "p1",
  dwell: { p1: 1.1, p2: .25, p3: .2, p4: .3, req: .2, app: .3, auto: .15, pick: .25, ship: .2, rcv: .2, re: .3 },
  route: () => { const r = BASE.slice(); if (Math.random() < .6) r[3] = "auto"; return r.concat(Math.random() < .12 ? LOOP : [], TAIL); },
};
const FIX = { ids: ["auto", "pick"], reveal: ["auto", "p1>auto", "auto>p2"] };

// Synthetic mined figures. The before→after deltas are set to Fettle's measured results (−65% wait, −50% rework, −40% cycle).
const M = { wait: 31, rework: 24, cycle: 5.0, breach: 7, cases: 1000 };
const REPLAY = { before: { m: 400, c: 500, r: 400, p: 500 }, after: { m: 75, c: 500, r: 75, p: 500 } };
const fitOf = (o: { m: number; c: number; r: number; p: number }) => fitness(o.m, o.c, o.r, o.p);

/* Per-site wait for the bias check (synthetic). DC-C uses legacy part codes, so the first draft auto-approves it far less. */
const SITES = [
  { dc: "DC-A", before: 30.2, draft: 9.8, amended: 10.1 },
  { dc: "DC-B", before: 31.5, draft: 10.6, amended: 10.9 },
  { dc: "DC-C", before: 31.3, draft: 27.9, amended: 11.6 },
];

type Gate = "idle" | "run" | "pass" | "fail";

function useLiveQueue(api: PetriApi | null, id: string) {
  const [q, setQ] = useState(0);
  useEffect(() => { if (!api) return; const t = setInterval(() => setQ(api.count(id)), 250); return () => clearInterval(t); }, [api, id]);
  return q;
}

/** The Mining steps of the Overview process. A hook because the steps share state (gate, approval, live queue). */
export function useMiningSlides(): Record<string, Slide> {
  const [api, setApi] = useState<PetriApi | null>(null);
  const q = useLiveQueue(api, "p1");
  const [afterApi, setAfterApi] = useState<PetriApi | null>(null);
  const qAfter = useLiveQueue(afterApi, "p1");
  const [promptMode, setPromptMode] = useState<"before" | "after">("after");
  const [gates, setGates] = useState<Record<string, Gate>>({ risk: "idle", bias: "idle", acc: "idle" });
  const [amended, setAmended] = useState(false);
  const [approved, setApproved] = useState(false);
  const [k, setK] = useState({ w: M.wait, rw: M.rework, ct: M.cycle, fit: fitOf(REPLAY.before) });
  const peak = useRef(0);
  peak.current = Math.max(peak.current, q);

  const allPass = gates.risk === "pass" && gates.bias === "pass" && gates.acc === "pass";
  const run = (g: string, ok: boolean | (() => boolean)) => {
    setGates((s) => ({ ...s, [g]: "run" }));
    setTimeout(() => setGates((s) => ({ ...s, [g]: (typeof ok === "function" ? ok() : ok) ? "pass" : "fail" })), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
  };
  const approve = () => {
    if (!allPass || approved) return;
    setApproved(true);
    tween(0, 1, 1400, (e) => setK({ w: M.wait * (1 - .65 * e), rw: M.rework * (1 - .5 * e), ct: M.cycle * (1 - .4 * e), fit: fitOf(REPLAY.before) + (fitOf(REPLAY.after) - fitOf(REPLAY.before)) * e }));
  };
  const resetAll = () => {
    setGates({ risk: "idle", bias: "idle", acc: "idle" }); setAmended(false); setApproved(false);
    setK({ w: M.wait, rw: M.rework, ct: M.cycle, fit: fitOf(REPLAY.before) });
  };

  const fixedProp = useMemo(() => (approved ? FIX : null), [approved]);
  const shown = Math.max(q, 0);

  const prompts = {
    before: `speed up approvals`,
    after: `## Context (mined from 1,000 spares requests, synthetic sample)
Process: request → approve → pick → ship → receive
Bottleneck: "approve", median wait ${M.wait} h (target 8 h); ${shown || peak.current} requests waiting right now
Rework: ${M.rework}% loop ship → mismatch → pick
Rule breaches: ${M.breach}% of cases pick with no approval event
Process fitness: ${fitOf(REPLAY.before).toFixed(2)}  (½(1 − m/c) + ½(1 − r/p), m=400 c=500 r=400 p=500)

## Task
Draft a change to the approval service so like-for-like spares
within limits agreed with the business are auto-approved, and add
scan-to-confirm at pick.

## Constraints  (rules from past review notes)
- Never auto-approve a part class that isn't on the allow-list.
- Every auto-approval writes an audit event: who, rule id, limit.
- Behind a feature flag per data centre; rollback = flag off.
- No change to the approver UI in this PR.

## Acceptance tests (generated from the mined variants)
1. Replay the 412 happy-path cases: all still pass.
2. Replay the 318 bottleneck cases: median wait ≤ 11 h.
3. Replay the 71 breach cases: every one now has an approval event.
4. Re-mined fitness ≥ 0.80.

## Out of scope
Pricing, supplier selection, anything outside spares requests.`,
  };

  const slides: Slide[] = [
    {
      id: "simulate", label: "Mine",
      body: (
        <Sec eyebrow="Step 1 of 7 · Mine: the event log as a live Petri net" title="Request → approve → pick → ship → receive" id="sim"
          lead="Each dot is a request. Circles are states and boxes are steps. Dots pile up where work waits; red dots have waited past target. The dashed red arc is the rework loop.">
          <div className="split">
            <div>
              <div className="diagram-box no-swipe"><PetriNet spec={SPEC} config={BEFORE} hot={["app", "re"]} onReady={setApi} /></div>
              <div className="legend" aria-hidden="true">
                <span><i style={{ background: "var(--act)" }} />request in flow</span>
                <span><i style={{ background: "var(--bad)" }} />waited past target</span>
                <span><i style={{ border: "2px solid var(--bad)" }} />bottleneck</span>
                <span><i style={{ border: "2px dashed var(--bad)" }} />rework loop</span>
              </div>
            </div>
            <div className="card" aria-live="polite">
              <h3>What the miner sees <Syn /></h3>
              <div className="kpi">
                <div className="k">Waiting at Approve now <b className="bad">{q}</b></div>
                <div className="k">Bottleneck wait (median) <b className="bad">{M.wait.toFixed(1)} h</b></div>
                <div className="k">Rework rate <b className="bad">{M.rework}%</b></div>
                <div className="k">Rule breaches (no approval event) <b className="bad">{M.breach}%</b></div>
                <div className="k">Process fitness <b className="bad">{fitOf(REPLAY.before).toFixed(2)}</b></div>
                <div className="meter bad"><i style={{ width: "20%" }} /></div>
              </div>
              <p className="small muted mt">The gap is plain: work waits at Approve, and 1 in 4 requests loops back to picking.</p>
              <a className="btn btn-primary" href="#fitness">Measure it →</a>
            </div>
          </div>
        </Sec>
      ),
    },
    {
      id: "prompt", label: "Prompt",
      body: (
        <Sec tone="alt" eyebrow="Step 3 of 7 · Prompt: from mined gap to Claude Code's context" title="The simulation writes Claude Code's context." id="pr"
          lead="A vague prompt gets a vague fix. The mined net already knows where the work waits, how often it loops and what done looks like, so the prompt carries numbers, rules and tests. The live queue count on the right updates from the simulation.">
          <div className="seg" role="tablist" aria-label="Prompt version">
            <button role="tab" aria-selected={promptMode === "before"} onClick={() => setPromptMode("before")}>Before: a one-liner</button>
            <button role="tab" aria-selected={promptMode === "after"} onClick={() => setPromptMode("after")}>After: a mined context pack</button>
          </div>
          <div className="split even mt">
            <pre className={"prompt " + promptMode} aria-live="polite" tabIndex={0}>{prompts[promptMode]}</pre>
            <div className="grid" style={{ alignContent: "start" }}>
              <div className="card flat"><h3>Why it's better</h3>
                <ul className="muted small">
                  <li><b>Located:</b> it names the step (Approve) and the size of the wait, not "approvals feel slow".</li>
                  <li><b>Bounded:</b> constraints from past review notes stop the agent from guessing.</li>
                  <li><b>Testable:</b> acceptance tests come from real variants, so "done" can be checked.</li>
                  <li><b>Safe:</b> a feature flag and rollback are part of the task, not an afterthought.</li>
                </ul></div>
              <div className="card flat"><h3>Measured at Crea</h3>
                <p className="muted small" style={{ margin: 0 }}>As feedback sharpened Claude's context, first-pass acceptance rose from <b>50% to 85%</b>, and <b>85%</b> of agent-drafted fix PRs merged after review.</p></div>
              <a className="btn btn-primary" href="#board">Let the agents draft →</a>
            </div>
          </div>
        </Sec>
      ),
    },
    {
      id: "gate", label: "Human gate",
      body: (
        <Sec eyebrow="Step 5 of 7 · Human gate: responsible AI" title="No fix ships until it passes, and a person signs." id="gt"
          lead={<>Claude Code drafted the fix. It must pass the checks the posting names: <q>risk assessment, bias mitigation, quality and accuracy reviews</q>. Run each check in turn.</>}>
          <div className="split even">
            <div className="gate">
              <div className={"check " + gates.risk}>
                <span className="dot" aria-hidden="true">{gates.risk === "pass" ? "✓" : "1"}</span>
                <div><h4>Risk assessment</h4><p>What's the blast radius if it's wrong? Allow-list only, per-site flag, audit on every auto-approval, rollback is turning the flag off.</p>
                  {gates.risk === "pass" && <p className="res">Low risk: 3 part classes on the allow-list; flag defaults to off; rollback tested.</p>}</div>
                <button className="btn btn-ghost" onClick={() => run("risk", true)} disabled={gates.risk === "run" || gates.risk === "pass" || approved}>Run</button>
              </div>
              <div className={"check " + gates.bias}>
                <span className="dot" aria-hidden="true">{gates.bias === "pass" ? "✓" : gates.bias === "fail" ? "!" : "2"}</span>
                <div><h4>Bias check across sites</h4><p>Does the fix help every data centre, or move the wait onto one of them?</p>
                  {gates.bias === "fail" && <p className="res">Flagged: DC-C still waits 27.9 h. Its legacy part codes miss the allow-list, so the draft auto-approves DC-C far less.</p>}
                  {gates.bias === "pass" && <p className="res">Passed after amending: legacy DC-C codes are mapped to the allow-list, and every site now lands within 1.5 h of the others.</p>}
                  {(gates.bias === "fail" || gates.bias === "pass") && (
                    <div className="table-wrap mt"><table>
                      <thead><tr><th>Site</th><th className="num">Before</th><th className="num">First draft</th><th className="num">Amended</th></tr></thead>
                      <tbody>{SITES.map((s) => (
                        <tr key={s.dc} className={s.dc === "DC-C" && !amended ? "below" : ""}><td>{s.dc}</td><td className="num">{s.before} h</td><td className="num">{s.draft} h</td><td className="num">{amended ? s.amended + " h" : "–"}</td></tr>
                      ))}</tbody>
                    </table></div>
                  )}
                  {gates.bias === "fail" && <button className="btn btn-primary mt" onClick={() => { setAmended(true); run("bias", true); }}>Amend: map legacy codes, re-run</button>}
                </div>
                <button className="btn btn-ghost" onClick={() => run("bias", () => amended)} disabled={gates.bias !== "idle" || approved}>Run</button>
              </div>
              <div className={"check " + gates.acc}>
                <span className="dot" aria-hidden="true">{gates.acc === "pass" ? "✓" : "3"}</span>
                <div><h4>Quality and accuracy review</h4><p>Replay the mined variants as acceptance tests, and re-mine fitness on cases held back from the draft.</p>
                  {gates.acc === "pass" && <p className="res">4 of 4 acceptance tests pass. Held-out fitness: 0.85.</p>}</div>
                <button className="btn btn-ghost" onClick={() => run("acc", true)} disabled={gates.acc === "run" || gates.acc === "pass" || approved}>Run</button>
              </div>
              <div className={"check " + (approved ? "pass" : "")}>
                <span className="dot" aria-hidden="true">{approved ? "✓" : "4"}</span>
                <div><h4>Human approval</h4><p>The process owner reads the diff, the test results and the bias table, then approves. Nothing merges without this step.</p>
                  {approved && <p className="res">Approved by the process owner. The review note is saved as a rule for the next prompt.</p>}</div>
                <button className="btn btn-primary" onClick={approve} disabled={!allPass || approved} aria-describedby="gate-hint">Approve</button>
              </div>
              <p id="gate-hint" className="small muted">{allPass ? (approved ? "" : "All three checks passed. Ready for a person to approve.") : "Approve unlocks when all three checks pass."}</p>
            </div>
            <div className="card flat" style={{ alignSelf: "start" }}>
              <h3>Why the bias check matters</h3>
              <p className="muted small">The average looked great: the first draft cut the wait at two sites by two thirds. But an average can hide one site left behind. Checking per site turned up DC-C. Without that check, the fix would have shipped with DC-C still waiting, and the review note would never have become a rule.</p>
              <p className="muted small">That note is now a constraint in the next prompt: <code>Check per-site impact before claiming an average.</code></p>
              <a className="btn btn-ghost" href="governance.html">All controls →</a>
            </div>
          </div>
        </Sec>
      ),
    },
    {
      id: "remine", label: "Re-mine",
      body: (
        <Sec tone="alt" eyebrow="Step 6 of 7 · Re-mine: did the fix work?" title={approved ? "Re-mined: the wait is gone." : "Waiting for a person to approve."} id="rm"
          lead={approved ? "The same net, re-mined after the approved fix. Auto-approve runs beside Approve, and scan-to-confirm at pick shrinks the rework loop." : "This step runs only after the fix is approved on the Responsible AI slide."}>
          <div className="split">
            <div>
              <div className="diagram-box no-swipe"><PetriNet spec={SPEC} config={approved ? AFTER : BEFORE} hot={["app", "re"]} fixed={fixedProp} onReady={setAfterApi} /></div>
              <div className="legend" aria-hidden="true"><span><i style={{ border: "2px solid var(--act)" }} />Fettle fix</span><span><i style={{ border: "2px solid var(--bad)" }} />bottleneck</span></div>
            </div>
            <div className="card" aria-live="polite">
              <h3>{approved ? "After the fix" : "Before"} <Syn /></h3>
              <div className="kpi">
                <div className="k">Waiting at Approve now <b className={approved ? "good" : "bad"}>{qAfter}</b></div>
                <div className="k">Bottleneck wait (median) <b className={approved ? "good" : "bad"}>{k.w.toFixed(1)} h</b></div>
                <div className="k">Rework rate <b className={approved ? "good" : "bad"}>{Math.round(k.rw)}%</b></div>
                <div className="k">Cycle time (median) <b>{k.ct.toFixed(1)} d</b></div>
                <div className="k">Process fitness <b className={approved ? "good" : "bad"}>{k.fit.toFixed(2)}</b></div>
                <div className={"meter" + (approved ? "" : " bad")}><i style={{ width: `${k.fit * 100}%` }} /></div>
              </div>
              {approved
                ? <p className="small muted mt">Bottleneck wait <b>−65%</b>, rework <b>−50%</b>, cycle time <b>−40%</b>, fitness <b>0.20 → 0.85</b>. These are Fettle's measured improvements, applied to this synthetic sample.</p>
                : <a className="btn btn-primary mt" href="#gate">Go to the gate →</a>}
              {approved && <button className="btn btn-ghost mt" onClick={resetAll}>Run the loop again</button>}
            </div>
          </div>
        </Sec>
      ),
    },
    {
      id: "fitness", label: "Measure",
      body: (
        <Sec eyebrow="Step 2 of 7 · Measure: token-replay fitness" title="Token replay: does the real log fit the model?" id="fi"
          lead={<>Replay every case through the target Petri net. If a step fires without the token it needed, the token is <b>missing</b>. If a token is still in the net when the case ends, it is <b>remaining</b>.</>}>
          <div className="grid g2">
            <R i={0} className="card">
              <Formula />
              <ul className="muted small">
                <li><b>m</b>: missing tokens, where steps were skipped or fired out of order</li><li><b>c</b>: tokens consumed</li>
                <li><b>r</b>: remaining tokens, where work was left hanging</li><li><b>p</b>: tokens produced</li>
              </ul>
              <p className="small muted">1.0 means every case followed the model. Fettle took a real ERP process from <b>0.20 to 0.85</b> (measured at Crea Digital Ventures).</p>
            </R>
            <R i={1} className="card">
              <h3>Replay of this sample <Syn /></h3>
              <div className="table-wrap"><table>
                <thead><tr><th></th><th className="num">m</th><th className="num">c</th><th className="num">r</th><th className="num">p</th><th className="num">fitness</th></tr></thead>
                <tbody>{(["before", "after"] as const).map((key) => { const o = REPLAY[key]; return (
                  <tr key={key}><td>{key === "before" ? "Before" : "After the fix"}</td><td className="num">{o.m}</td><td className="num">{o.c}</td><td className="num">{o.r}</td><td className="num">{o.p}</td><td className="num"><b>{fitOf(o).toFixed(2)}</b></td></tr>); })}</tbody>
              </table></div>
            </R>
          </div>
          <R i={2} className="mt">
            <h3>Variants in the log <Syn /></h3>
            <div className="table-wrap"><table>
              <thead><tr><th>Variant</th><th className="num">Cases</th><th className="num">Share</th><th>Reading</th></tr></thead>
              <tbody>
                <tr><td>request → approve → pick → ship → receive</td><td className="num">412</td><td className="num">41%</td><td>The model</td></tr>
                <tr className="below"><td>request → approve (waited &gt; 24 h) → pick → ship → receive</td><td className="num">318</td><td className="num">32%</td><td>Bottleneck</td></tr>
                <tr className="below"><td>… ship → mismatch → pick → ship → receive</td><td className="num">164</td><td className="num">16%</td><td>Rework loop</td></tr>
                <tr className="below"><td>request → pick → ship → receive (no approval)</td><td className="num">71</td><td className="num">7%</td><td>Rule breach</td></tr>
                <tr><td>request → approve → cancelled</td><td className="num">35</td><td className="num">4%</td><td>Abandoned</td></tr>
              </tbody>
            </table></div>
          </R>
          <div className="row mt"><a className="btn btn-primary" href="#prompt">Turn the gap into a prompt →</a></div>
        </Sec>
      ),
    },
  ];
  return Object.fromEntries(slides.map((x) => [x.id, x]));
}
