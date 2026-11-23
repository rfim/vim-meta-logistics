import type { CSSProperties } from "react";

// Simple Icons slug, name, brand hex, dark brand (falls back to text colour on hover so it stays visible in dark mode).
// No CC0 or official file exists for Debezium or Multica, so they appear as text chips. We never draw a logo.
const LOGOS: [string, string, string?, boolean?][] = [
  ["python", "Python", "#3776AB"], ["typescript", "TypeScript", "#3178C6"], ["javascript", "JavaScript", "#F7DF1E"],
  ["react", "React", "#61DAFB"], ["fastapi", "FastAPI", "#009688"], ["postgresql", "PostgreSQL", "#4169E1"],
  ["databricks", "Databricks", "#FF3621"], ["apachespark", "Apache Spark", "#E25A1C"], ["apachekafka", "Apache Kafka", "#231F20", true],
  ["debezium", "Debezium"], ["dbt", "dbt", "#FF694B"], ["apacheairflow", "Apache Airflow", "#017CEE"],
  ["snowflake", "Snowflake", "#29B5E8"], ["amazonwebservices", "AWS", "#232F3E", true], ["terraform", "Terraform", "#844FBA"],
  ["docker", "Docker", "#2496ED"], ["kubernetes", "Kubernetes", "#326CE5"], ["github", "GitHub", "#181717", true],
  ["claude", "Claude", "#D97757"], ["anthropic", "Anthropic", "#191919", true], ["multica", "Multica"],
];

// Absolute URL: a relative url() inside a CSS custom property would resolve against the stylesheet's folder.
const icon = (slug: string) => `url("${new URL(`assets/logos/${slug}.svg`, document.baseURI).href}")`;

export function LogoWall() {
  return (
    <div className="logos" role="list" aria-label="Technologies">
      {LOGOS.map(([slug, name, hex, dark]) => hex ? (
        <span key={slug} className="logo" role="listitem" tabIndex={0} style={{ "--c": dark ? "var(--text)" : hex } as CSSProperties}>
          <i role="img" aria-label={`${name} logo`} style={{ WebkitMaskImage: icon(slug), maskImage: icon(slug) }} />{name}
        </span>
      ) : (
        <span key={slug} className="logo textchip" role="listitem" tabIndex={0} title={`${name}: no free logo file, shown as text`}>
          <span className="t">{name}</span>
        </span>
      ))}
    </div>
  );
}

/* Employers from the CV, newest first. Each file comes from the company's own site (see SOURCES.md). */
const COS: { name: string; src: string; dark?: string; tile: "bare" | "light" | "dark"; w: number; years: string }[] = [
  { name: "Crea Digital Ventures", src: "crea-digital-ventures.svg", dark: "crea-digital-ventures-on-dark.svg", tile: "bare", w: 182, years: "2025 – now" },
  { name: "Lifepal", src: "lifepal.svg", tile: "light", w: 84, years: "2022 – 2026" },
  { name: "Deloitte", src: "deloitte.svg", tile: "dark", w: 120, years: "2020 – 2022" },
  { name: "ATI Business Group", src: "ati-business-group.png", tile: "light", w: 96, years: "2016 – 2020" },
  { name: "Astra International", src: "astra-international-white.png", tile: "dark", w: 92, years: "2016 – 2020" },
  { name: "Hacktiv8", src: "hacktiv8.png", tile: "light", w: 100, years: "Instructor, 2019 – now" },
];

export function CompanyWall() {
  return (
    <div className="co-logos" role="list" aria-label="Companies I've worked with">
      {COS.map((c) => (
        <figure key={c.name} className="co-item" role="listitem">
          <span className={"co " + (c.tile === "bare" ? "bare" : c.tile === "dark" ? "darktile" : "")}>
            {c.dark
              ? <><img className="only-light" src={`assets/companies/${c.src}`} alt={c.name} width={c.w} height={26} /><img className="only-dark" src={`assets/companies/${c.dark}`} alt={c.name} width={c.w} height={26} /></>
              : <img src={`assets/companies/${c.src}`} alt={c.name} width={c.w} height={26} />}
          </span>
          <figcaption>{c.years}</figcaption>
        </figure>
      ))}
    </div>
  );
}
