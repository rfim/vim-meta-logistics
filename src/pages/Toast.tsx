import { Deck, type Slide } from "../components/Deck";
import { R, Sec, Stat } from "../components/Bits";
import { CodeTabs } from "../components/Code";
import { PaperHero } from "../components/PaperHero";
import { ToastFigure } from "../components/Figures";
import { Runner } from "../components/Runner";
import { TOAST_STEPS } from "../data/toastSteps";
import audit from "../../code/sql/toast/01_audit_trail.sql?raw";
import lots from "../../code/sql/toast/02_lot_traceability.sql?raw";
import fifo from "../../code/sql/toast/03_fifo_pick.sql?raw";

const NOTE = "Written for this portfolio to show the pattern; not Toast's production schema.";

const slides: Slide[] = [
  {
    id: "top", label: "Toast",
    body: (
      <PaperHero
        kicker="Product 2 · built on Fettle · Crea Digital Ventures"
        title="Toast"
        subtitle="Traceable ERP and analytics for hospitality and gastrodiplomacy"
        author={<><b>R. Firman Insan Muhammad (VIM)</b> · Crea Digital Ventures, London</>}
        figure={<ToastFigure />}
        caption="Bag to cup. A lot moves from supplier to cup (top), and every move writes an entry to the audit trail (bottom): what moved, who moved it, when. Stock is picked oldest-first. Any change an AI assistant proposes waits for a person's approval. Lot traceability is a concept in Toast; the audit trail is how its ERP works."
        oneLine={<><em>Toast is an ERP that remembers every move.</em> Where an item is, who touched it last, and what it's waiting for.</>}
        abstract="Toast helps venues promote national cuisine and culture abroad. It combines an inventory and supplier ERP (categories, suppliers, products with variants, pricing and dimensions) with analytics for leadership. Every change is traced to who made it and when, 12 leadership assistants each work under their own least-privilege role, and onboarding runs through five promotion tracks with a 30-minute emergency path."
        keywords={["ERP", "audit trail", "lot traceability", "FIFO", "least privilege", "human approval"]}
        results={[["45%", "improvement across compliance, cost and revenue"], ["12", "leadership assistants"], ["26.4 s → 21.1 s", "median answer, 24 test questions"]]}
        actions={<><a className="btn btn-primary" href="#run">Run it, step by step →</a><a className="btn btn-ghost" href="#sql">Read the SQL</a></>}
      />
    ),
  },
  {
    id: "inside", label: "What's inside",
    body: (
      <Sec tone="alt" eyebrow="Measured at Crea Digital Ventures" title="Compliance, cost and revenue." id="ti">
        <R className="stats">
          <Stat blue v="45%" l="improvement across compliance, cost and revenue" />
          <Stat v="12" l="leadership assistants, each under its own least-privilege role" />
          <Stat blue v="5" l="dashboards" />
          <Stat v="20% faster" l="short-answer mode: 26.4 s → 21.1 s median, 24 test questions" />
          <Stat blue v="5 tracks" l="promotion tracks, from 1-hour config to 10-day governance" />
          <Stat v="30 min" l="emergency path" />
        </R>
        <div className="grid g2 mt">
          <R i={1} className="card"><h3>Inventory and supplier ERP</h3><p className="muted small">Categories, suppliers and products with variants, pricing and dimensions. Every change is traced to who made it and when, through an append-only audit trail. Humans approve every AI change.</p></R>
          <R i={2} className="card"><h3>Lot traceability, bag to cup (concept)</h3><p className="muted small">A QR bean passport with bean, roast date and lot, plus order-ahead, staff dispatch and margin per drink. It's the same question I'd ask of a data centre spare: where is it, who touched it last, and what is it waiting for?</p></R>
        </div>
      </Sec>
    ),
  },
  {
    id: "run", label: "Run it, step by step",
    body: (
      <Sec tone="alt" eyebrow="Run the real SQL · PostgreSQL in your browser" title="Audit trail, AI guardrail, FIFO, recall." id="tr"
        lead="Real PostgreSQL running in your browser with PGlite. Create the ERP, change a price, watch an AI change get blocked until a person approves it, then pick FIFO and recall a lot.">
        <Runner engine="postgres" steps={TOAST_STEPS} intro="Synthetic sample data. Lot traceability is a concept in Toast; the audit pattern is how its ERP works." />
      </Sec>
    ),
  },
  {
    id: "sql", label: "SQL",
    body: (
      <Sec eyebrow="Source · PostgreSQL" title="Audit trail, lots and FIFO." id="ts"
        lead="Three files that show how Toast keeps every change, lot and pick accountable. The FIFO query is the same logic that runs on the Spares page.">
        <CodeTabs label="Toast SQL files" files={[
          { name: "Audit trail", path: "code/sql/toast/01_audit_trail.sql", lang: "sql", code: audit, note: NOTE + " A trigger writes every change, and a second trigger rejects an AI assistant's change unless a person approved it." },
          { name: "Lot traceability", path: "code/sql/toast/02_lot_traceability.sql", lang: "sql", code: lots, note: "Concept. Stock is derived from moves, so there's no mutable quantity to drift. Scan a cup and get the path back to the farm." },
          { name: "FIFO pick", path: "code/sql/toast/03_fifo_pick.sql", lang: "sql", code: fifo, note: NOTE + " Includes a check that catches FIFO breaches after the fact." },
        ]} />
      </Sec>
    ),
  },
];

export function Toast() { return <Deck slides={slides} />; }
