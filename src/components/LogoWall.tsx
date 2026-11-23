import type { CSSProperties } from "react";

// Simple Icons slug, name, brand hex, dark brand (falls back to text colour on hover so it stays visible in dark mode).
// No CC0 or official file exists for Debezium or Multica, so they appear as text chips. We never draw a logo.
const LOGOS: [string, string, string?, boolean?][] = [
  ["databricks", "Databricks", "#FF3621"], ["apachekafka", "Apache Kafka", "#231F20", true], ["debezium", "Debezium"],
  ["dbt", "dbt", "#FF694B"], ["apacheairflow", "Apache Airflow", "#017CEE"], ["amazonwebservices", "AWS", "#232F3E", true],
  ["terraform", "Terraform", "#844FBA"], ["docker", "Docker", "#2496ED"], ["kubernetes", "Kubernetes", "#326CE5"],
  ["postgresql", "PostgreSQL", "#4169E1"], ["snowflake", "Snowflake", "#29B5E8"], ["python", "Python", "#3776AB"],
  ["react", "React", "#61DAFB"], ["typescript", "TypeScript", "#3178C6"], ["fastapi", "FastAPI", "#009688"],
  ["claude", "Claude", "#D97757"], ["anthropic", "Anthropic", "#191919", true], ["github", "GitHub", "#181717", true],
  ["multica", "Multica"],
];

export function LogoWall() {
  return (
    <div className="logos" role="list" aria-label="Technologies">
      {LOGOS.map(([slug, name, hex, dark]) => hex ? (
        <span key={slug} className="logo" role="listitem" tabIndex={0}
          style={{ "--m": `url('assets/logos/${slug}.svg')`, "--c": dark ? "var(--text)" : hex } as CSSProperties}>
          <i role="img" aria-label={`${name} logo`} />{name}
        </span>
      ) : (
        <span key={slug} className="logo textchip" role="listitem" tabIndex={0}>
          <span className="t">{name}</span><span aria-hidden="true">text chip</span>
        </span>
      ))}
    </div>
  );
}
