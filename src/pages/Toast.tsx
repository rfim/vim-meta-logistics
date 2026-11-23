import { Deck, type Slide } from "../components/Deck";
import { R, Sec, Stat } from "../components/Bits";
import { CodeTabs } from "../components/Code";
import audit from "../../code/sql/toast/01_audit_trail.sql?raw";
import lots from "../../code/sql/toast/02_lot_traceability.sql?raw";
import fifo from "../../code/sql/toast/03_fifo_pick.sql?raw";

const NOTE = "Written for this portfolio to show the pattern; not Toast's production schema.";

const slides: Slide[] = [
  {
    id: "top", label: "Toast",
    body: (
      <section className="hero on-dark" aria-labelledby="to">
        <div className="wrap">
          <R i={0}><span className="eyebrow">Product 2 · built on Fettle · Crea Digital Ventures</span></R>
          <R i={1}><h1 id="to">TOAST</h1></R>
          <R i={2}><p className="lede">Hospitality intelligence for gastrodiplomacy: helping venues promote national cuisine and culture abroad.</p></R>
          <R i={3}><p style={{ maxWidth: "62ch" }}>An inventory and supplier ERP where every change is traced to who made it and when, plus leadership assistants, safe onboarding and lot traceability (concept). Gains are measured on each venue's own metrics.</p></R>
          <R i={4} className="row mt on-dark"><a className="btn btn-primary" href="#inside">What's inside →</a><a className="btn btn-ghost" href="#sql">Read the SQL</a></R>
        </div>
      </section>
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
