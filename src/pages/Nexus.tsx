import { Deck, type Slide } from "../components/Deck";
import { R, Sec, Stat } from "../components/Bits";
import { CodeTabs } from "../components/Code";
import cdc from "../../code/sql/nexus/01_cdc_merge.sql?raw";
import quality from "../../code/sql/nexus/02_quality_and_holds.sql?raw";
import gold from "../../code/sql/nexus/03_gold_kimball.sql?raw";

const NOTE = "Written for this portfolio to show the pattern I used at Lifepal; not Lifepal's production code.";

const FLOW: [string, string, string][] = [
  ["01 · Sources", "PostgreSQL, APIs, files", "Operational records and partner feeds"],
  ["02 · Ingest", "Kafka + Debezium CDC", "Change events, replayable"],
  ["03 · Bronze", "Raw, on Delta", "Never updated in place"],
  ["04 · Silver", "Current state", "Typed, deduplicated, newest record wins"],
  ["05 · Gold", "Kimball, dbt", "Certified models for people and agents"],
  ["06 · Serve", "Nexus app, FastAPI, BI", "RAG copilot and MCP for governed agent access"],
];

const slides: Slide[] = [
  {
    id: "top", label: "Nexus",
    body: (
      <section className="hero on-dark" aria-labelledby="nx">
        <div className="wrap">
          <R i={0}><span className="eyebrow">Earlier career · Lifepal · 2022 – 2026</span></R>
          <R i={1}><h1 id="nx">NEXUS</h1></R>
          <R i={2}><p className="lede">The data platform I built at Lifepal: Kafka and Debezium into a Databricks lakehouse, with dbt and Airflow on AWS and Terraform.</p></R>
          <R i={3}><p style={{ maxWidth: "62ch" }}>I led the data platform and a team of 3–5 engineers, partnering with product managers, Finance and Marketing. Every record is traceable to its source, its load time and its batch.</p></R>
          <R i={4} className="row mt on-dark"><a className="btn btn-primary" href="#flow">The path →</a><a className="btn btn-ghost" href="#sql">Read the SQL</a></R>
        </div>
      </section>
    ),
  },
  {
    id: "flow", label: "The path",
    body: (
      <Sec tone="alt" eyebrow="Measured at Lifepal" title="From source to a number people trust." id="nf">
        <R className="stats">
          <Stat blue v="24 h → 5 min" l="reporting" /><Stat v="6 h → 90 min" l="nightly batch" />
          <Stat blue v="−60%" l="data-trust escalations" /><Stat v="500+" l="automated quality checks" />
        </R>
        <div className="grid g3 mt">
          {FLOW.map(([n, t, d], k) => <R key={n} i={k} className="card flat"><span className="eyebrow">{n}</span><h3>{t}</h3><p className="muted small">{d}</p></R>)}
        </div>
      </Sec>
    ),
  },
  {
    id: "sql", label: "SQL",
    body: (
      <Sec eyebrow="Source · Databricks SQL + dbt" title="CDC merge, quality holds, Gold." id="ns"
        lead="The three moves that made Nexus trustworthy: newest record wins, a load is held if it looks wrong, and Gold is a shared, tested star schema.">
        <CodeTabs label="Nexus SQL files" files={[
          { name: "CDC merge", path: "code/sql/nexus/01_cdc_merge.sql", lang: "sql", code: cdc, note: NOTE + " Ordered by the source log sequence number, so replays and retries can't overwrite newer data." },
          { name: "Quality and holds", path: "code/sql/nexus/02_quality_and_holds.sql", lang: "sql", code: quality, note: NOTE + " Holds a load if |V − μ30| > 3σ30, runs the critical checks, and measures freshness the way a consumer feels it." },
          { name: "Gold (dbt)", path: "code/sql/nexus/03_gold_kimball.sql", lang: "sql", code: gold, note: NOTE + " An incremental Kimball fact with lineage columns and the tests that gate certification." },
        ]} />
      </Sec>
    ),
  },
];

export function Nexus() { return <Deck slides={slides} />; }
