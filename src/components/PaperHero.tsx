import type { ReactNode } from "react";
import { R } from "./Bits";

/** A product page opens like a paper: title, author line, Figure 1 (animated), caption, one plain line, abstract. */
export function PaperHero({ kicker, title, subtitle, author, figure, caption, oneLine, abstract, keywords, results, actions }: {
  kicker: string; title: string; subtitle: string; author: ReactNode; figure: ReactNode; caption: ReactNode;
  oneLine: ReactNode; abstract: ReactNode; keywords: string[]; results: [string, string][]; actions: ReactNode;
}) {
  return (
    <section className="section paper" aria-labelledby="paper-title">
      <div className="wrap">
        <R i={0}><p className="paper-kicker">{kicker}</p></R>
        <R i={1}><h1 id="paper-title" className="paper-title">{title}<span>{subtitle}</span></h1></R>
        <R i={2}><p className="paper-author">{author}</p></R>
        <div className="paper-grid">
          <R i={3} className="paper-figure">
            <figure>
              {figure}
              <figcaption><b>Figure 1.</b> {caption}</figcaption>
            </figure>
          </R>
          <R i={4} className="paper-text">
            <p className="paper-one">{oneLine}</p>
            <p className="paper-abstract"><b>Abstract.</b> {abstract}</p>
            <p className="paper-keys"><b>Keywords:</b> {keywords.join(" · ")}</p>
            <dl className="paper-results">
              {results.map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}
            </dl>
            <div className="row">{actions}</div>
          </R>
        </div>
      </div>
    </section>
  );
}
