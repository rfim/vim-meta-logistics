import { Deck, type Slide } from "../components/Deck";
import { R, Sec, Stat } from "../components/Bits";
import { CodeTabs } from "../components/Code";
import { PaperHero } from "../components/PaperHero";
import { NexusFigure } from "../components/Figures";
import { Runner } from "../components/Runner";
import { NEXUS_STEPS } from "../data/nexusSteps";
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
      <PaperHero
        kicker="Earlier work · Lifepal · 2022 – 2026"
        title="Nexus"
        subtitle="A streaming lakehouse for insurtech"
        author={<><b>R. Firman Insan Muhammad (VIM)</b> · Lead Data Engineer, Lifepal</>}
        figure={<NexusFigure />}
        caption="One bad row, no blocked batch. Change events move from sources through capture into the lakehouse and validation. Good rows (green) continue to publication. A row that fails a check (red) waits in quarantine with its reason, is corrected, and replays safely. The rest of the batch never stops."
        oneLine={<><em>Nexus is a lakehouse that keeps moving when data gets messy.</em> One bad row never blocks the batch.</>}
        abstract="I led Lifepal's data platform and a team of 3–5 engineers. Nexus replaced scattered batch jobs with one governed path: Kafka and Debezium change data capture into Databricks with dbt and Airflow on AWS and Terraform. Every record is traceable to its source, load time and batch, and more than 500 automated checks hold a load before anyone sees bad numbers."
        keywords={["change data capture", "Kafka", "Debezium", "Delta Lake", "dbt", "data quality"]}
        results={[["24 h → 5 min", "reporting"], ["6 h → 90 min", "nightly batch"], ["−60%", "data-trust escalations"], ["500+", "automated checks"]]}
        actions={<><a className="btn btn-primary" href="#run">Run it, step by step →</a><a className="btn btn-ghost" href="#sql">Read the SQL</a></>}
      />
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
    id: "run", label: "Run it, step by step",
    body: (
      <Sec eyebrow="Run the pattern · PostgreSQL in your browser" title="Replays, late events, and the newest change wins." id="nr"
        lead="Production ran on Databricks. This is a faithful PostgreSQL port of the same pattern, so it can run here: land change events, merge them, replay safely, gate quality and check freshness.">
        <Runner engine="postgres" steps={NEXUS_STEPS} intro="Synthetic change events, including a replayed duplicate and one that arrives late." />
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
