import { Deck, type Slide } from "../components/Deck";
import { R, Sec, Stat } from "../components/Bits";
import { CodeTabs } from "../components/Code";
import { Runner } from "../components/Runner";
import { FETTLE_STEPS } from "../data/fettleSteps";
import miner from "../../code/python/fettle_mine.py?raw";
import minerOut from "../../code/python/sample_output.txt?raw";
import petriTs from "../lib/petri.ts?raw";
import petriTsx from "../components/PetriNet.tsx?raw";
import orbitTsx from "../components/Orbit.tsx?raw";

const slides: Slide[] = [
  {
    id: "top", label: "Fettle",
    body: (
      <section className="hero on-dark" aria-labelledby="fe">
        <div className="wrap">
          <R i={0}><span className="eyebrow">Product 1 · built in Crea Digital Ventures · 2025 – now</span></R>
          <R i={1}><h1 id="fe">FETTLE</h1></R>
          <R i={2}><p className="lede">A mine-to-fix flywheel. Process mining finds where work waits; Claude Code drafts the fix; a person approves it; the log is mined again.</p></R>
          <R i={3}><p style={{ maxWidth: "62ch" }}>ERP event logs (orders, stock movements, supplier approvals) become Petri nets. The gaps become Claude Code's context, Multica priorities and acceptance tests. Every cycle is faster and more accurate than the last, with a person in control of every change.</p></R>
          <R i={4} className="row mt on-dark"><a className="btn btn-primary" href="mining.html">Run the live simulation →</a><a className="btn btn-ghost" href="overview.html#flywheel">The flywheel</a><a className="btn btn-ghost" href="#python">Read the code</a></R>
        </div>
      </section>
    ),
  },
  {
    id: "results", label: "Results",
    body: (
      <Sec tone="alt" eyebrow="Measured at Crea Digital Ventures" title="Comply, cut cost, grow revenue." id="fr">
        <R className="stats">
          <Stat blue v="−80%" l="rule breaches" /><Stat v="0.20 → 0.85" l="process fitness" />
          <Stat blue v="−65%" l="bottleneck wait" /><Stat v="−50%" l="rework" />
          <Stat blue v="−40%" l="cycle time" /><Stat v="+65%" l="more cases per team" />
          <Stat blue v="−75%" l="log preparation time" /><Stat v="85%" l="of agent-drafted fix PRs merged after review" />
          <Stat blue v="50% → 85%" l="first-pass acceptance" />
        </R>
        <div className="grid g3 mt">
          <R i={1} className="card flat"><h3>Live simulation</h3><p className="muted small">The Petri net, the prompt it writes, the responsible-AI gate and the re-mined result.</p><a href="mining.html">Mining →</a></R>
          <R i={2} className="card flat"><h3>The flywheel</h3><p className="muted small">Two wheels, review notes that become rules, an agent board and the impact.</p><a href="overview.html#flywheel">The flywheel →</a></R>
          <R i={3} className="card flat"><h3>Notebook</h3><p className="muted small">Run the whole method in your browser, cell by cell.</p><a href="notebook.html">Notebook →</a></R>
        </div>
      </Sec>
    ),
  },
  {
    id: "learns", label: "How the AI learns",
    body: (
      <Sec tone="alt" eyebrow="How process mining makes the AI better" title="No retraining. Better context, every cycle." id="fl"
        lead="Fettle doesn't fine-tune Claude, so the model's weights never change. What improves is everything around the model: the facts it's given, the rules it must follow, the tests it must pass, and the approved examples it learns from. Process mining and human review supply each one.">
        <ol className="learn">
          <R as="li" i={0}><b>Mine → facts.</b> The event log becomes numbers the agent can't argue with: which step waits, how long, per site, and how often it loops. <span className="muted">Step 4 of the runner.</span></R>
          <R as="li" i={1}><b>Facts → context pack.</b> Those numbers, the target and the process model go into the prompt in place of "speed up approvals". <span className="muted">Step 6.</span></R>
          <R as="li" i={2}><b>Variants → acceptance tests.</b> Real cases from the log become the tests a fix must pass, so "done" is measurable. This is the evaluation set.</R>
          <R as="li" i={3}><b>Review notes → rules.</b> Every comment a reviewer makes becomes a standing constraint in the next prompt, like a rules file the agent reads first. <a href="overview.html#rules">See it →</a></R>
          <R as="li" i={4}><b>Approved fixes → examples.</b> Each merged fix, with the context that produced it, becomes a worked example for the next similar gap. The agent starts from what a person already approved.</R>
          <R as="li" i={5}><b>Gaps → priorities.</b> The mined gaps become Multica priorities, so the agents work on the wait that costs the most first. <a href="overview.html#board">See the board →</a></R>
          <R as="li" i={6}><b>Re-mine → score.</b> The new log proves whether the fix worked. That result is the feedback signal that decides what's kept. <span className="muted">Step 7.</span></R>
        </ol>
        <R i={7} className="stats mt">
          <Stat blue v="50% → 85%" l="first-pass acceptance as feedback sharpened the context" />
          <Stat v="85%" l="of agent-drafted fix PRs merged after review" />
          <Stat blue v="0.20 → 0.85" l="process fitness" />
        </R>
        <R i={8}><p className="small muted mt">Measured at Crea Digital Ventures. A person approves every change before it ships.</p></R>
      </Sec>
    ),
  },
  {
    id: "run", label: "Run it, step by step",
    body: (
      <Sec eyebrow="Run the real code · Python in your browser" title="Mine a log, step by step." id="fr2"
        lead="This is the real code/python/fettle_mine.py, running in your browser with Pyodide. Each step shares one session, like a notebook. Edit any step and run it again.">
        <Runner engine="python" steps={FETTLE_STEPS} files={{ "fettle_mine.py": miner }} intro="Synthetic sample log, seeded, so you'll get the same numbers I did." />
      </Sec>
    ),
  },
  {
    id: "python", label: "Python: mining",
    body: (
      <Sec eyebrow="Source · Python" title="The mining half, in plain Python." id="fp"
        lead="Event log → directly-follows graph → variants → waits → token-replay fitness → a context pack for Claude Code. Standard library only. Run it with python3 code/python/fettle_mine.py.">
        <CodeTabs label="Python files" files={[
          { name: "fettle_mine.py", path: "code/python/fettle_mine.py", lang: "py", code: miner, note: "Written for this portfolio to show the method. The production Fettle code at Crea Digital Ventures isn't published. The log is a seeded synthetic sample." },
          { name: "Output", path: "code/python/sample_output.txt", lang: "txt", code: minerOut, note: "The real output of the script above on its synthetic log, including the context pack it writes for Claude Code." },
        ]} />
      </Sec>
    ),
  },
  {
    id: "react", label: "React: Petri net",
    body: (
      <Sec tone="alt" eyebrow="Source · React + TypeScript" title="The Petri net you see on this site." id="fx"
        lead="These are this site's own files, imported as raw text at build time, so what you read here is exactly what runs on the Mining and Flywheel pages.">
        <CodeTabs label="React files" files={[
          { name: "PetriNet.tsx", path: "src/components/PetriNet.tsx", lang: "ts", code: petriTsx, note: "The React wrapper: the engine owns the drawing, React owns the state (config, bottleneck, fix)." },
          { name: "petri.ts", path: "src/lib/petri.ts", lang: "ts", code: petriTs, note: "The engine: places, transitions, arcs, and tokens that queue at places. Plain SVG with no chart library, and a vertical layout below 620 px." },
          { name: "Orbit.tsx", path: "src/components/Orbit.tsx", lang: "ts", code: orbitTsx, note: "The flywheel animation in three styles: figure-eight, single orbit and loop track." },
        ]} />
      </Sec>
    ),
  },
];

export function Fettle() { return <Deck slides={slides} />; }
