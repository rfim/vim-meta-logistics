import { Deck, type Slide } from "../components/Deck";
import { CV } from "../components/Chrome";
import { R, Sec } from "../components/Bits";
import { CompanyWall, LogoWall } from "../components/LogoWall";
import { ImpactSlide, flywheelSlides } from "../components/FlywheelParts";

// Quoted exactly from Meta's posting (metacareers.com job 1611664887040314).
const ROLE: [string, string, string, string][] = [
  ["Design, build, test, deploy and maintain tools and software solutions to support internal automation opportunities",
    "Fettle drafts fixes with Claude Code against acceptance tests; 85% of agent-drafted fix PRs merged after review.", "#flywheel", "The flywheel"],
  ["Lead sessions to identify process inefficiencies, gather business requirements, partner with development teams to manage deliverables, testing and validation, roll-out training, and triage and resolution of issues",
    "I start with the event log, not opinions: the Petri net shows where work waits and where it loops.", "mining.html", "Mining, live"],
  ["Partner with the business and software engineers to design, deploy and maintain asset management, inventory management and logistical systems for Meta's Data Centers",
    "Data centre logistics is new to me. Here's how I'd start: reorder points, an asset lifecycle with RMA, FIFO lots. Synthetic sample.", "spares.html", "Spares"],
  ["Demonstrated ability to integrate AI tools to optimize/redesign workflows and drive measurable impact (e.g., efficiency gains, quality improvements)",
    "Rule breaches −80%, bottleneck wait −65%, cycle time −40%, first-pass acceptance 50% → 85%.", "#results", "Results"],
  ["Demonstrated ongoing AI skill development (e.g., prompt/context engineering, agent orchestration) and staying current with emerging AI technologies",
    "A mined context pack in place of “speed up approvals”, review notes that become rules, and an agent board.", "mining.html#prompt", "Context engineering"],
  ["Experience adhering to and implementing responsible, ethical AI practices (e.g., risk assessment, bias mitigation, quality and accuracy reviews)",
    "Humans approve every AI change, each assistant has a least-privilege role, and changes go through five promotion tracks.", "governance.html", "Governance"],
  ["Experience in distribution center/hub solution implementation, warehouse fulfillment, lot tracking or FIFO",
    "Toast's lot traceability is a concept; FIFO lot picking in SQL is on the spares page.", "spares.html#fifo", "FIFO"],
  ["Experience using Oracle, SAP or other ERP platforms for supply chain management",
    "Some Crea Digital Ventures clients run SAP or Oracle, and Fettle mines their event logs (purchase orders, approvals, receipts, stock movements) into the agents' feedback loop. Toast includes its own inventory and supplier ERP.", "index.html#erp", "SAP and Oracle, step by step"],
];

const slides: Slide[] = [
  {
    id: "top", label: "Firman (VIM)",
    body: (
      <section className="hero on-dark" aria-labelledby="hero-title">
        <div className="wrap">
          <R i={1}><span className="eyebrow">Business solutions architect · London · for Business Solutions Engineer, Logistics</span></R>
          <R i={2}><h1 id="hero-title" className="hero-h1-name">R. Firman Insan Muhammad <span>(VIM)</span></h1></R>
          <R i={3}><p className="lede">I find where work waits, and I build the tools that end the wait.</p></R>
          <R i={4}><p style={{ maxWidth: "62ch" }}>What I built: <b style={{ color: "#fff" }}>FETTLE</b>, a mine-to-fix flywheel, at Crea Digital Ventures. Process mining turns ERP event logs into Petri nets. The gaps it finds become Claude Code's context, Multica priorities and acceptance tests. Claude Code drafts the fix, a person approves it, and the log is mined again to prove it worked.</p></R>
          <R i={5} className="row mt">
            <a className="btn btn-primary" href="fettle.html">What I built: Fettle →</a>
            <a className="btn btn-ghost" href="mining.html">See a log mined, live</a>
            <a className="btn btn-ghost" href="index.html">The fireside chat</a>
            <a className="btn btn-ghost" href={CV}>Download CV (PDF) ↓</a>
          </R>
        </div>
      </section>
    ),
  },
  {
    id: "role", label: "Per the role",
    body: (
      <Sec eyebrow="Per the role" title="Your posting, line by line." id="role" lead="Each line is quoted exactly from Meta's posting, with where to find my answer.">
        <ul className="per-role">
          {ROLE.map(([q, a, href, link], k) => (
            <R as="li" i={k} key={k}><q>{q}</q><span className="ans">{a} <a href={href}>{link} →</a></span></R>
          ))}
        </ul>
      </Sec>
    ),
  },
  ...flywheelSlides,
  {
    id: "results", label: "Results",
    body: (
      <Sec tone="alt" eyebrow="What the flywheel changed · Fettle at Crea Digital Ventures" title="Measured, not modelled." id="res"
        lead="Measured results from Fettle at Crea Digital Ventures, before and after. The before value is indexed to 100 unless stated. None of these are Meta numbers.">
        <ImpactSlide />
        <R i={1}><p className="small muted mt">Also measured: <b>85%</b> of agent-drafted fix PRs merged after review.</p></R>
      </Sec>
    ),
  },
  {
    id: "products", label: "Fettle & Toast",
    body: (
      <Sec eyebrow="Two products" title="One engine, two uses." id="prod">
        <div className="grid g2">
          <R i={0}><a className="card product" href="#flywheel">
            <span className="kicker">Hero product · mine-to-fix flywheel</span>
            <span className="name">FETTLE</span>
            <p className="muted" style={{ margin: 0 }}>Process mining ↔ Claude Code. Each cycle mines the log, ranks the gaps, drafts the fix, waits for a person's approval and mines the log again.</p>
            <ul><li>Process fitness 0.20 → 0.85</li><li>Bottleneck wait −65%, rework −50%</li><li>65% more cases per team</li></ul>
            <span className="go">How the flywheel turns →</span>
          </a></R>
          <R i={1}><a className="card product" href="index.html#toast">
            <span className="kicker">Built on Fettle · hospitality intelligence</span>
            <span className="name">TOAST</span>
            <p className="muted" style={{ margin: 0 }}>Hospitality intelligence for gastrodiplomacy: an inventory and supplier ERP, leadership assistants, safe onboarding and lot traceability (concept).</p>
            <ul><li>45% improvement across compliance, cost and revenue</li><li>12 leadership assistants, each under its own least-privilege role; 5 dashboards</li><li>Humans approve every AI change</li></ul>
            <span className="go">Toast in the story →</span>
          </a></R>
        </div>
      </Sec>
    ),
  },
  {
    id: "built", label: "Built with",
    body: (
      <Sec tone="alt" eyebrow="Built with" title="The stack behind the work." id="bw" lead={<>Hover over or focus a tile to see its brand colour. Icons come from Simple Icons; sources and licences are listed in <a href="https://github.com/rfim/vim-meta-logistics/blob/main/public/assets/logos/SOURCES.md">SOURCES.md</a>.</>}>
        <LogoWall />
        <h3 className="mt">Where I've worked</h3>
        <CompanyWall />
      </Sec>
    ),
  },
  {
    id: "plainly", label: "Stated plainly",
    body: (
      <Sec eyebrow="Earlier career, and stated plainly" title="Before Fettle, and what's real." id="pl">
        <div className="grid g2">
          <R i={0} className="card"><h3>Lifepal · Nexus data platform</h3><p className="muted">Led the data platform and a team of 3–5 engineers.</p>
            <ul className="muted"><li>Reporting 24 h → 5 min</li><li>Nightly batch 6 h → 90 min</li><li>Data-trust escalations −60%</li></ul></R>
          <R i={1} className="card"><h3>Deloitte · consulting</h3><p className="muted">Led requirements workshops for banks and insurers.</p><ul className="muted"><li>Manual processing −50%</li></ul></R>
        </div>
        <div className="grid g3 mt">
          <R i={2} className="card flat"><h3>Measured</h3><p className="muted">Fettle, Toast, Lifepal and Deloitte figures are results from my work, as stated in my CV.</p></R>
          <R i={3} className="card flat"><h3>Synthetic</h3><p className="muted">Every Meta-side number (parts, data centres, lead times, lots) is a labelled <b>synthetic sample</b>. The flywheel replay is illustrative between the measured start and end values.</p></R>
          <R i={4} className="card flat"><h3>New to me</h3><p className="muted">I haven't worked in data centre logistics. It's new to me and I'm keen to learn it. What carries over is the method: mine the flow, find the wait, and fix it with a person in control.</p></R>
        </div>
        <R i={5} className="row mt"><a className="btn btn-primary" href={CV}>Download CV (PDF) ↓</a><a className="btn btn-ghost" href="index.html">Pull up a chair →</a></R>
      </Sec>
    ),
  },
];

export function Index() { return <Deck slides={slides} />; }
