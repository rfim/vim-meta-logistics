import type { CSSProperties, ReactNode } from "react";

/** Section wrapper used inside a slide. tone: "" | "alt" | "dark" */
export function Sec({ tone = "", eyebrow, title, lead, children, id }: { tone?: "" | "alt" | "dark"; eyebrow?: string; title?: ReactNode; lead?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section className={"section " + tone} aria-labelledby={id ? id + "-h" : undefined}>
      <div className="wrap">
        {(eyebrow || title || lead) && (
          <div className="section-head reveal-up">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 id={id ? id + "-h" : undefined}>{title}</h2>}
            {lead && <p>{lead}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Staggered entrance when the slide becomes active */
export const R = ({ i = 0, className = "", style, children, as: Tag = "div" }: { i?: number; className?: string; style?: CSSProperties; children: ReactNode; as?: "div" | "li" | "span" }) => (
  <Tag className={"reveal-up " + className} style={{ ...style, ["--i" as string]: i }}>{children}</Tag>
);

export function Stat({ v, l, blue }: { v: string; l: string; blue?: boolean }) {
  return <div className={"stat" + (blue ? " blue" : "")}><b>{v}</b><span>{l}</span></div>;
}

/** Tween a number with ease-out; respects reduced motion */
export function tween(from: number, to: number, ms: number, on: (v: number) => void) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { on(to); return; }
  const t0 = performance.now();
  const f = (t: number) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    on(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

/** Token-replay fitness: ½(1 − m/c) + ½(1 − r/p) */
export const fitness = (m: number, c: number, r: number, p: number) => 0.5 * (1 - m / c) + 0.5 * (1 - r / p);

export function Formula() {
  return (
    <p className="formula" aria-label="fitness equals one half times one minus m over c, plus one half times one minus r over p">
      fitness = ½(1 − <span className="frac"><span>m</span><span>c</span></span>) + ½(1 − <span className="frac"><span>r</span><span>p</span></span>)
    </p>
  );
}
