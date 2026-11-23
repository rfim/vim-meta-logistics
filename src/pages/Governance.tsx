import { Deck, type Slide } from "../components/Deck";
import { R, Sec } from "../components/Bits";

const MAP: { words: string; controls: string[]; evidence: string; link?: [string, string] }[] = [
  {
    words: "risk assessment",
    controls: [
      "Every change is sorted by blast radius into one of five promotion tracks, from a 1-hour config change to a 10-day governance review with senior sign-off.",
      "A 30-minute emergency path, so urgent fixes don't bypass the rules.",
      "Each AI assistant runs under its own least-privilege role.",
      "Fixes ship behind a flag, and rollback is part of the task.",
    ],
    evidence: "Toast: five promotion tracks, a 30-minute emergency path, and 12 leadership assistants each under its own least-privilege role.",
  },
  {
    words: "bias mitigation",
    controls: [
      "Check impact per site, team or segment before claiming an average.",
      "Gate on the worst-served group, not just the mean.",
      "Synthetic fixtures in tests; never copy production names or personal data into prompts.",
    ],
    evidence: "How I work. The Mining page shows the check in action on a synthetic sample: a first draft that left DC-C behind is flagged and amended before approval.",
    link: ["mining.html#gate", "See the bias check"],
  },
  {
    words: "quality and accuracy reviews",
    controls: [
      "Acceptance tests are generated from mined variants, so “done” is testable.",
      "The log is re-mined after every fix to prove it worked.",
      "Humans approve every AI change.",
      "Review notes become rules in the next prompt.",
      "A fixed set of test questions measures assistant changes.",
    ],
    evidence: "Fettle: 85% of agent-drafted fix PRs merged after review; first-pass acceptance 50% → 85%. Toast: short-answer mode 20% faster (26.4 s → 21.1 s median, 24 test questions).",
    link: ["flywheel.html#rules", "Notes → rules"],
  },
];

const slides: Slide[] = [
  {
    id: "top", label: "In the posting's words",
    body: (
      <section className="hero on-dark" aria-labelledby="gv">
        <div className="wrap">
          <R i={0}><span className="eyebrow">Responsible AI</span></R>
          <R i={1}><h1 id="gv" style={{ fontSize: "clamp(2rem,5.4vw,3.6rem)", maxWidth: "20ch" }}>In the posting's own words.</h1></R>
          <R i={2}><blockquote style={{ margin: "0 0 1em", padding: "16px 20px", borderLeft: "4px solid var(--sky)", background: "rgba(255,255,255,.04)", borderRadius: "0 8px 8px 0", color: "#fff", fontSize: "1.15rem", maxWidth: "62ch" }}>
            <q>Experience adhering to and implementing responsible, ethical AI practices (e.g., risk assessment, bias mitigation, quality and accuracy reviews)</q>
            <footer style={{ color: "var(--mist)", fontSize: ".85rem", marginTop: 8 }}>Meta posting, Business Solutions Engineer, Logistics</footer>
          </blockquote></R>
          <R i={3}><p className="lede">Below, each of those three phrases is mapped to the controls I use and the evidence behind them.</p></R>
          <R i={4} className="row mt"><a className="btn btn-primary" href="#map">The mapping →</a><a className="btn btn-ghost" href="mining.html#gate">The gate, live</a></R>
        </div>
      </section>
    ),
  },
  ...MAP.map((m, k): Slide => ({
    id: k === 0 ? "map" : "c" + k, label: m.words[0].toUpperCase() + m.words.slice(1),
    body: (
      <Sec tone={k % 2 ? "alt" : ""} eyebrow={`Posting phrase ${k + 1} of 3`} title={<>“{m.words}”</>} id={"g" + k}>
        <div className="grid g2">
          <R i={0} className="card"><h3>My controls</h3><ul>{m.controls.map((c) => <li key={c} style={{ marginBottom: 6 }}>{c}</li>)}</ul></R>
          <R i={1} className="card flat"><h3>Evidence</h3><p className="muted">{m.evidence}</p>{m.link && <a className="btn btn-ghost" href={m.link[0]}>{m.link[1]} →</a>}</R>
        </div>
      </Sec>
    ),
  })),
  {
    id: "tracks", label: "Promotion tracks",
    body: (
      <Sec eyebrow="Safe onboarding in Toast" title="Five promotion tracks, one emergency path." id="pt" lead="A change takes the track that matches its risk. The fastest and slowest tracks are shown; the three in between scale with blast radius.">
        <R className="card">
          <div style={{ display: "grid", gap: 10 }}>
            <div className="bar-row"><span className="lab">Track 1 · config change</span><span className="bar after"><i style={{ width: "8%" }} /></span><span className="val">1 hour</span></div>
            <div className="bar-row"><span className="lab muted">Tracks 2–4</span><span className="bar" style={{ background: "repeating-linear-gradient(90deg,var(--bg-2) 0 8px,var(--line) 8px 10px)" }}><i /></span><span className="val muted">scaled</span></div>
            <div className="bar-row"><span className="lab">Track 5 · governance, senior sign-off</span><span className="bar after"><i style={{ width: "100%" }} /></span><span className="val">10 days</span></div>
            <div className="bar-row"><span className="lab">Emergency path</span><span className="bar before"><i style={{ width: "4%" }} /></span><span className="val" style={{ color: "var(--bad)" }}>30 min</span></div>
          </div>
          <p className="small muted mt">On every track, a person approves every AI change. Onboarding runs as a deterministic state machine, so a change can't skip a step.</p>
        </R>
      </Sec>
    ),
  },
];

export function Governance() { return <Deck slides={slides} />; }
