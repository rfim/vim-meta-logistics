import { useState, type ReactNode } from "react";
import { Deck, type Slide } from "../components/Deck";
import { CV } from "../components/Chrome";
import { R, Sec } from "../components/Bits";
import { Runner } from "../components/Runner";
import { FETTLE_STEPS } from "../data/fettleSteps";
import { TOAST_STEPS } from "../data/toastSteps";
import { NEXUS_STEPS } from "../data/nexusSteps";
import { ERP_STEPS } from "../data/erpSteps";
import { FettleArt, NexusArt, ToastArt } from "../components/HeroArt";
import { Lab } from "../components/Lab";
import miner from "../../code/python/fettle_mine.py?raw";

const You = ({ children, i = 0 }: { children: ReactNode; i?: number }) => (
  <R i={i} className="msg you"><span className="who" aria-hidden="true">You</span><div className="b"><span className="name">You</span>{children}</div></R>
);
const Vim = ({ children, i = 0 }: { children: ReactNode; i?: number }) => (
  <R i={i} className="msg vim"><span className="who" aria-hidden="true">VIM</span><div className="b"><span className="name">Vim</span>{children}</div></R>
);

/* "Pull up a chair": questions you can tap */
const CHAIR: [string, ReactNode][] = [
  ["What's the first thing you'd ask for on day one?", <>The event log for one flow, read-only: case id, activity, timestamp, who did it. Spares requests are a good start because the steps are clear and the cost of waiting is easy to see.</>],
  ["How do you work with software engineers?", <>I bring them the gap as a ticket they can test: the mined variant, the target, and the acceptance tests. Then I stay for the review. At Crea, 85% of agent-drafted fix PRs merged after review, and the review notes went straight back into the next prompt as rules.</>],
  ["What if the business doesn't trust the miner?", <>Then we replay their own cases together in the session and watch the tokens stop where they say it's slow. That's usually enough. Where it isn't, the disagreement itself is a requirement to write down.</>],
  ["How do you roll out training?", <>Each fix ships with a one-page "what changed and why" for the people who use the process, plus a short session. Training is part of done, not a follow-up.</>],
  ["What would you need to learn fastest?", <>The data centre itself: how spares move between sites, what RMA means for each part class, and who signs off what. I'd shadow the floor before I'd touch a log.</>],
];

/* "What would you do?" decisions */
type Dec = { q: string; opts: string[]; pick: number; tried: string; broke: string; call: string };
const DEC: Dec[] = [
  { q: "Approvals are slow. The team asks for a faster approval screen. What do you build first?",
    opts: ["A faster screen", "Mine the log first", "Add more approvers"], pick: 1,
    tried: "Build the faster screen the team asked for.",
    broke: "If the wait is in the queue before anyone opens the request, a faster screen changes nothing. Only the log tells you which it is.",
    call: "Mine first, then fix the step that actually waits. At Crea, Fettle's mined fixes cut bottleneck wait by 65%." },
  { q: "Claude Code's first fixes keep missing the point. What do you change?",
    opts: ["A bigger model", "A longer prompt", "A mined context pack"], pick: 2,
    tried: "Describe the problem in words, like \u201Cspeed up approvals\u201D.",
    broke: "The drafts look plausible but can't be tested, because nobody said what done looks like.",
    call: "Give the agent the mined numbers, the rules from past reviews and the acceptance tests. At Crea, first-pass acceptance rose from 50% to 85% as feedback sharpened the context." },
  { q: "A fix improves the average a lot, but one site barely moves. Ship it?",
    opts: ["Ship, it's a win on average", "Hold and check per site", "Roll it back"], pick: 1,
    tried: "Ship it and report the average.",
    broke: "An average hides the site left behind, and that site's team stops trusting the tool.",
    call: "Gate on per-site impact before claiming the average, and fix the gap first. You can see this on the Mining page's bias check." },
];

function Decisions() {
  const [k, setK] = useState(0);
  const [guess, setGuess] = useState<Record<number, number>>({});
  const d = DEC[k], g = guess[k];
  return (
    <div className="card dq" aria-live="polite">
      <div className="seg" role="tablist" aria-label="Decisions">
        {DEC.map((_, j) => <button key={j} role="tab" aria-selected={j === k} onClick={() => setK(j)}>Decision {j + 1}{guess[j] !== undefined ? " ✓" : ""}</button>)}
      </div>
      <h3 style={{ fontSize: "1.3rem" }}>{d.q}</h3>
      <div className="opts">
        {d.opts.map((o, j) => (
          <button key={j} className={g === j ? "pick" : ""} disabled={g !== undefined} onClick={() => setGuess({ ...guess, [k]: j })}>
            {o}{g !== undefined && j === d.pick ? " ← my call" : ""}
          </button>
        ))}
      </div>
      {g !== undefined ? (
        <div className="grid g3">
          <div className="card flat"><span className="eyebrow">The tempting move</span><p className="small">{d.tried}</p></div>
          <div className="card flat"><span className="eyebrow" style={{ color: "var(--bad)" }}>Why it breaks</span><p className="small">{d.broke}</p></div>
          <div className="card flat"><span className="eyebrow">My call</span><p className="small">{d.call}</p></div>
        </div>
      ) : <p className="small muted">Make your guess, then see what I did.</p>}
      {g !== undefined && k < DEC.length - 1 && <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => setK(k + 1)}>Next decision →</button>}
    </div>
  );
}

function Chair() {
  const [open, setOpen] = useState<number[]>([]);
  return (
    <div className="chat">
      <div className="row">
        {CHAIR.map(([q], j) => (
          <button key={j} className="chip" style={{ cursor: "pointer", padding: "8px 14px" }} aria-pressed={open.includes(j)}
            onClick={() => setOpen(open.includes(j) ? open.filter((x) => x !== j) : [...open, j])}>{q}</button>
        ))}
      </div>
      {open.map((j) => (
        <div key={j} style={{ display: "contents" }}>
          <You><p>{CHAIR[j][0]}</p></You>
          <Vim i={1}><p>{CHAIR[j][1]}</p></Vim>
        </div>
      ))}
      {open.length === 0 && <p className="muted small">Tap a question to ask it.</p>}
    </div>
  );
}

const slides: Slide[] = [
  {
    id: "top", label: "Hello",
    body: (
      <section className="hero on-dark" aria-labelledby="st">
        <div className="wrap">
          <R className="strip" i={0}>
            <div className="side" aria-label="Built in Crea Digital Ventures"><small>Built in</small>
              <img className="crea" src="assets/companies/crea-digital-ventures-on-dark.svg" alt="Crea Digital Ventures" width={182} height={26} /></div>
            <span className="arrow" aria-hidden="true">→</span>
            <div className="side" aria-label="Presented to Meta, Data Center Logistics"><small>Presented to</small>
              <img className="meta-dark" src="assets/meta/meta-lockup-negative-white.svg" alt="Meta" width={93} height={40} /><b>· Data Center Logistics</b></div>
          </R>
          <R i={0}><span className="eyebrow">A fireside chat · for Business Solutions Engineer, Logistics · London</span></R>
          <R i={1}><h1 id="st" style={{ fontSize: "clamp(2rem,5vw,3.4rem)", maxWidth: "24ch" }}>I'm Firman Insan Muhammad. You can call me <span style={{ color: "var(--sky)" }}>VIM</span>.</h1></R>
          <R i={2}><p className="lede">Meta's data centres run on spare parts, work orders and approvals. I find where that work waits, then build the tools that end the wait: with AI a person approves, and numbers that prove it worked.</p><p style={{ margin: "0 0 18px", opacity: .8 }}>Business solutions architect with a data engineering background · London · no sponsorship required.</p></R>
          <R i={3}><p style={{ color: "#fff", fontWeight: 600, marginBottom: 12 }}>Three systems I've built, and the data-centre question each one already answers:</p></R>
          <div className="built-three">
            <R i={3}><a className="b3" href="fettle.html"><FettleArt /><b>FETTLE</b><i className="b3-q">Where do work orders stall?</i><span>A mine-to-fix flywheel for ERP. Mining finds where work waits, Claude Code drafts the fix, a person approves. Rule breaches −80%.</span><i className="b3-dc">At Meta: approval queues, RMA loops, slow sites</i><small>Crea Digital Ventures →</small></a></R>
            <R i={4}><a className="b3" href="toast.html"><ToastArt /><b>TOAST</b><i className="b3-q">Where is this part, and who touched it last?</i><span>ERP and analytics for hospitality and gastrodiplomacy, built on Fettle. Lots traced from supplier to venue. 45% improvement across compliance, cost and revenue.</span><i className="b3-dc">At Meta: spare-parts custody, FIFO picks, lot holds</i><small>Crea Digital Ventures →</small></a></R>
            <R i={5}><a className="b3" href="nexus.html"><NexusArt /><b>NEXUS</b><i className="b3-q">Is the stock number still true?</i><span>A lakehouse for insurtech: Kafka and Debezium into Databricks. Reporting went from 24 h to 5 min.</span><i className="b3-dc">At Meta: live inventory and asset truth across sites</i><small>Lifepal →</small></a></R>
          </div>
          <R i={6}><p style={{ margin: "12px 0 10px" }}>Pull up a chair. Ask me anything; every answer links to something you can open and run.</p></R>
          <R i={6} className="row on-dark"><a className="btn btn-primary" href="#fettle">Start the conversation →</a><a className="btn btn-ghost" href="overview.html">The one-minute overview</a><a className="btn btn-ghost" href={CV}>CV (PDF) ↓</a></R>
        </div>
      </section>
    ),
  },
  {
    id: "fettle", label: "Fettle",
    body: (
      <Sec eyebrow="The conversation · 1" title="Fettle, in plain words." id="f">
        <div className="chat">
          <You i={0}><p>So what is Fettle?</p></You>
          <Vim i={1}><p>A mine-to-fix flywheel. Process mining turns ERP event logs (orders, stock movements, supplier approvals) into Petri nets that show where work waits. Those gaps become Claude Code's context, Multica priorities and acceptance tests. Claude Code drafts the fix, a person approves it, and we mine the log again to prove it worked.</p></Vim>
          <You i={2}><p>Did it work?</p></You>
          <Vim i={3}><p>At Crea Digital Ventures: rule breaches down 80%, process fitness up from 0.20 to 0.85, bottleneck wait down 65%, rework down 50%, cycle time down 40%, and 65% more cases handled by the same team.</p></Vim>
          <You i={4}><p>Why mine first, instead of just asking the AI?</p></You>
          <Vim i={5}><p>Because "speed up approvals" is a feeling. A mined net is a measurement: which step, how long and how often it loops. Give the agent that and the tests to match, and first-pass acceptance went from 50% to 85%. <a href="overview.html#prompt">See the prompt it writes →</a></p></Vim>
        </div>
      </Sec>
    ),
  },
  {
    id: "lab", label: "Process Lab",
    body: (
      <Sec tone="alt" eyebrow="The conversation · try it yourself" title="Pick a source. Watch the process appear." id="slab"
        lead="You asked how Fettle works on real systems. Choose a data-centre spares flow, the data-centre pipeline, SAP, Oracle or Odoo. The lab extracts the tables, discovers the process as a Petri net and simulates it, finds where work waits, writes the prompt for Claude Code, Codex or an in-house agent, then applies the fix and mines again.">
        <Lab initial="metadc" sources={["metadc", "dcpipe", "sap", "oracle", "odoo"]} />
      </Sec>
    ),
  },
  {
    id: "code", label: "Fettle, step by step",
    body: (
      <Sec eyebrow="The conversation · show me" title="Fettle, step by step, with code you can run." id="sc"
        lead={<>You asked how Fettle works. Here it is, run for real: the actual Python from Fettle's mining half, in your browser. Step 4 finds the wait, step 6 writes Claude Code's context, and step 7 re-mines after the fix. The SQL guardrails run on the <a href="toast.html#run">Toast</a> and <a href="nexus.html#run">Nexus</a> pages.</>}>
        <Runner engine="python" steps={FETTLE_STEPS} files={{ "fettle_mine.py": miner }} intro="Synthetic sample log, seeded, so you'll get the same numbers I did. Edit any step and run it again." />
      </Sec>
    ),
  },
  {
    id: "toast", label: "Toast",
    body: (
      <Sec tone="alt" eyebrow="The conversation · 2" title="Toast, built on Fettle." id="t">
        <div className="chat">
          <You i={0}><p>And Toast?</p></You>
          <Vim i={1}><p>Hospitality intelligence for gastrodiplomacy: helping venues promote national cuisine and culture abroad. It's built on Fettle, and it showed a 45% improvement across compliance, cost and revenue, measured on each venue's own metrics.</p></Vim>
          <You i={2}><p>What's inside it?</p></You>
          <Vim i={3}><p>An inventory and supplier ERP where every change is traced to who made it and when. 12 leadership assistants, each under its own least-privilege role, and 5 dashboards. Safe onboarding with five promotion tracks, from a 1-hour config change to a 10-day governance review, plus a 30-minute emergency path. Humans approve every AI change. Lot traceability is a concept so far.</p></Vim>
          <You i={4}><p>Anything you measured on the assistants?</p></You>
          <Vim i={5}><p>A short-answer mode made them 20% faster: median 26.4 s down to 21.1 s, across 24 test questions.</p></Vim>
        </div>
      </Sec>
    ),
  },
  {
    id: "toast-code", label: "Toast, step by step",
    body: (
      <Sec eyebrow="The conversation · show me Toast" title="Toast, step by step, on real PostgreSQL." id="stc"
        lead={<>The ERP pattern behind Toast, running in your browser. Create the tables and the audit trail, change a price and see who touched it, then watch an AI assistant's change get <b>blocked</b> until a person approves it. Then pick FIFO and recall a lot.</>}>
        <Runner engine="postgres" steps={TOAST_STEPS} intro="Synthetic sample data. Lot traceability is a concept in Toast; the audit pattern is how its ERP works." />
      </Sec>
    ),
  },
  {
    id: "plainly", label: "Stated plainly",
    body: (
      <Sec eyebrow="The conversation · 3" title="The honest part." id="h">
        <div className="chat">
          <You i={0}><p>Have you worked in data centre logistics?</p></You>
          <Vim i={1}><p>No. It's new to me, and I'm keen to learn it. The method carries over: find where work waits in a flow, fix it with tests, and keep a person in control. Spares, RMA and FIFO lots are flows like any other, so I've sketched how I'd start, on synthetic data. <a href="spares.html">Spares →</a></p></Vim>
          <You i={2}><p>Oracle or SAP?</p></You>
          <Vim i={3}><p>Yes. Some Crea Digital Ventures clients run SAP or Oracle, and Fettle mines their logs: purchase orders, approvals, goods receipts and stock movements, from the tables where each system keeps them. Those logs feed the same loop as everything else: mine, give the agent the context, a person reviews, then re-mine. I also shipped an inventory and supplier ERP (React 19 and TypeScript) for Toast. <a href="#erp">See the SAP and Oracle loop, step by step →</a></p></Vim>
          <You i={4}><p>And before Crea?</p></You>
          <Vim i={5}><p>At Lifepal I led the data platform: reporting from 24 h to 5 min, the nightly batch from 6 h to 90 min, and data-trust escalations down 60%. At Deloitte, manual processing fell 50%.</p></Vim>
        </div>
      </Sec>
    ),
  },
  {
    id: "erp", label: "SAP & Oracle, step by step",
    body: (
      <Sec eyebrow="The conversation · show me SAP and Oracle" title="SAP and Oracle logs, mined into the agents' feedback loop." id="serp"
        lead="How it works on an ERP: extract the purchase-to-receipt trail from SAP (EKKO, change documents, EKBE) and Oracle (PO headers, PO_ACTION_HISTORY, RCV_TRANSACTIONS), map both to one event log, and mine it. The agent gets the mined context, a person reviews its fixes, and the reviews become rules and examples for the next cycle. Then mine again.">
        <Runner engine="postgres" steps={ERP_STEPS} intro="Real PostgreSQL in your browser. Tables are SAP- and Oracle-shaped and simplified, with synthetic data: no client data is shown." />
      </Sec>
    ),
  },
  {
    id: "nexus-code", label: "Nexus, step by step",
    body: (
      <Sec tone="alt" eyebrow="The conversation · show me Nexus" title="Nexus, step by step: the newest change wins." id="snc"
        lead="The pattern behind Lifepal's lakehouse. Production ran on Databricks; this is a faithful PostgreSQL port so it can run here. Land change events (one replayed, one late), merge them so the newest change wins, replay safely, gate quality and check freshness.">
        <Runner engine="postgres" steps={NEXUS_STEPS} intro="Synthetic change events. Lifepal results: reporting 24 h → 5 min, data-trust escalations −60%." />
      </Sec>
    ),
  },
  {
    id: "principle", label: "Principle",
    body: (
      <section className="section dark" aria-labelledby="pr-h">
        <div className="wrap">
          <R i={0}><span className="eyebrow" style={{ color: "var(--sky)" }}>Operating principle</span></R>
          <R i={1}><h2 id="pr-h" className="principle" style={{ color: "#fff" }}>If a tool cannot show where an item is, who touched it last and what it is waiting for, it is not finished.</h2></R>
          <R i={2}><p style={{ maxWidth: "60ch" }}>That's the bar for every tool I build: a spares request, a lot of SSDs, a supplier approval. If you can't answer those three questions from the tool, you're answering them from someone's memory.</p></R>
        </div>
      </section>
    ),
  },
  { id: "chair", label: "Pull up a chair", body: <Sec tone="alt" eyebrow="Pull up a chair" title="Ask me anything on this list." id="c"><Chair /></Sec> },
  { id: "decide", label: "What would you do?", body: <Sec eyebrow="Three decisions · you guess first" title="What would you do?" id="d" lead="Three calls that come up in work like Fettle. Make your guess, then see the tempting move, why it breaks, and the call I'd make."><Decisions /></Sec> },
  {
    id: "ask", label: "Ask me",
    body: (
      <section className="section dark" aria-labelledby="ask-h">
        <div className="wrap">
          <R i={0}><span className="eyebrow" style={{ color: "var(--sky)" }}>Continue the conversation</span></R>
          <R i={1}><h2 id="ask-h" style={{ color: "#fff", fontSize: "clamp(1.8rem,4.4vw,3rem)", maxWidth: "20ch" }}>Ask me where a spares flow would bend first.</h2></R>
          <R i={2}><p style={{ maxWidth: "58ch" }}>My guess, before seeing a single log: at approval and at the RMA return, where an item waits for someone who isn't watching the queue. I'd like to be proved wrong by your data.</p></R>
          <R i={3} className="row mt on-dark"><a className="btn btn-primary" href="mailto:firman.insan.m@gmail.com">firman.insan.m@gmail.com</a><a className="btn btn-ghost" href={CV}>CV (PDF) ↓</a><a className="btn btn-ghost" href="spares.html#tuesday">A Tuesday at DC-C →</a></R>
        </div>
      </section>
    ),
  },
];

export function Story() { return <Deck slides={slides} />; }
