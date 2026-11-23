import { useEffect, useState } from "react";

export const CV = "Firman_Muhammad_CV_Business_Solutions_Engineer.pdf";
// For this role (Meta)
export const PAGES: [string, string][] = [
  ["index.html", "Story"],
  ["overview.html", "Overview"],
  ["mining.html", "Mining"],
  ["flywheel.html", "Flywheel"],
  ["spares.html", "Spares"],
  ["governance.html", "Governance"],
  ["notebook.html", "Notebook"],
];
// My products: shown as one tinted group in the nav
export const PRODUCTS: [string, string, string][] = [
  ["fettle.html", "Fettle", "Mine-to-fix flywheel for ERP · Crea Digital Ventures"],
  ["toast.html", "Toast", "ERP and analytics for hospitality · Crea Digital Ventures"],
  ["nexus.html", "Nexus", "Lakehouse for insurtech · Lifepal"],
];

/** Fettle, Toast and Nexus: inline, side by side, on a shared tint so they read as one family. */
function ProductGroup({ here }: { here: string }) {
  return (
    <div className="prodgroup" role="group" aria-label="My products">
      {PRODUCTS.map(([h, t, d]) => (
        <a key={h} href={h} title={d} aria-current={h === here ? "page" : undefined}>{t}</a>
      ))}
    </div>
  );
}

type Theme = "light" | "dark" | null;
const readSaved = (): Theme => {
  try {
    const v = localStorage.getItem("fettle-theme");
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
};

/** Follows the OS theme unless the visitor picked one. Returns whether the page is dark right now. */
export function useDark() {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const [saved, setSaved] = useState<Theme>(readSaved);
  const [os, setOs] = useState(!!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const f = () => setOs(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [mq]);
  useEffect(() => {
    if (saved) document.documentElement.dataset.theme = saved;
    else delete document.documentElement.dataset.theme;
  }, [saved]);
  const dark = saved ? saved === "dark" : os;
  const toggle = () => {
    const next = dark ? "light" : "dark";
    try { localStorage.setItem("fettle-theme", next); } catch { /* private mode */ }
    setSaved(next);
  };
  return { dark, toggle };
}

export function Header() {
  const { dark, toggle } = useDark();
  const [open, setOpen] = useState(false);
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const here = page;
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="index.html" aria-label="R. Firman Insan Muhammad (VIM): FETTLE for Meta. Home">
          <span className="me"><span className="full">R. Firman Insan Muhammad </span><b>VIM</b></span>
          <span className="sep" aria-hidden="true">·</span>
          <span>FETTLE</span>
          <span className="for">for</span>
          {/* Official Meta lockup, unaltered. Primary on light, negative primary on dark. */}
          <img className="meta-logo" src={dark ? "assets/meta/meta-lockup-negative-white.svg" : "assets/meta/meta-lockup-primary.svg"} alt="Meta" width={84} height={36} />
        </a>
        <button className="icon-btn menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>Menu</button>
        <nav className={"nav" + (open ? " open" : "")} id="site-nav" aria-label="Primary">
          {PAGES.slice(0, 2).map(([h, t]) => (
            <a key={h} href={h} aria-current={h === here || (here === "" && h === "index.html") ? "page" : undefined}>{t}</a>
          ))}
          <ProductGroup here={here} />
          {PAGES.slice(2).map(([h, t]) => (
            <a key={h} href={h} aria-current={h === here ? "page" : undefined}>{t}</a>
          ))}
          <a href={CV}>CV ↓</a>
          <button className="icon-btn theme-btn" type="button" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? "☀" : "☾"}</button>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer in-slide">
      <div className="wrap">
        <div className="cols">
          <div><b style={{ color: "var(--text)" }}>FETTLE</b> · a mine-to-fix flywheel, built in Crea Digital Ventures.<br />
            <b style={{ color: "var(--text)" }}>TOAST</b> · hospitality intelligence for gastrodiplomacy, built on Fettle.</div>
          <div>R. Firman Insan Muhammad (VIM) · Business solutions architect with a data engineering background · London · no sponsorship required<br />
            <a href="mailto:firman.insan.m@gmail.com">firman.insan.m@gmail.com</a> · <a href={CV}>CV (PDF)</a></div>
          <div>Every Meta-side number on this site is a <b>synthetic sample</b>. Fettle, Toast and earlier-career figures are measured results from my work. <a href="https://github.com/rfim/vim-meta-logistics">Source on GitHub</a></div>
        </div>
        <p className="disc">An independent application, not affiliated with or endorsed by Meta.</p>
      </div>
    </footer>
  );
}

export const Syn = () => <span className="tag-syn">Synthetic sample</span>;
