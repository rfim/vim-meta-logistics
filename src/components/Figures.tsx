// "Figure 1" animations for the product pages, drawn like figures in a paper.
// Pure SVG + SMIL: they start on open, loop quietly, and stay still for reduced motion.
// Colours come from CSS variables (via style), so the figures follow light and dark mode.
import type { CSSProperties } from "react";

const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const st = (o: CSSProperties) => o;
const ACT = st({ fill: "var(--act)" }), CARD = st({ fill: "var(--card)" }), INK = st({ fill: "var(--text)" }), INK2 = st({ fill: "var(--text-2)" });
const LINE = st({ stroke: "var(--line)" }), ACTS = st({ stroke: "var(--act)" });

/** Light up at fraction f of the loop and stay lit until the loop restarts */
const lit = (f: number, dur: number) => (
  <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${Math.max(0.001, f).toFixed(4)};${Math.min(0.999, f + 0.006).toFixed(4)};1`} dur={`${dur}s`} repeatCount="indefinite" />
);

/* ------------------------------------------------------------------ Fettle */
export function FettleFigure() {
  const m = still(), dur = 9;
  const r = 108, cy = 160, c1 = 212, c2 = c1 + 2 * r, x0 = c1 + r; // the two loops meet at x0
  const d = `M${x0},${cy} A${r},${r} 0 1,0 ${c1 - r},${cy} A${r},${r} 0 1,0 ${x0},${cy} A${r},${r} 0 1,1 ${c2 + r},${cy} A${r},${r} 0 1,1 ${x0},${cy}`;
  const U = [0.25, 0.4167, 0.5833, 0.75]; // top, upper side, lower side, bottom: away from the crossing
  const left = ["event log", "discover", "conform", "find the wait"], right = ["context", "draft", "human review", "feedback"];
  // left loop runs anticlockwise from the crossing; right loop clockwise from the crossing
  const pt = (side: 0 | 1, u: number, rr: number): [number, number] => {
    const a = side === 0 ? 2 * Math.PI * u : Math.PI - 2 * Math.PI * u;
    const cx = side === 0 ? c1 : c2;
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  };
  const stations = [...left.map((l, i) => ({ l, side: 0 as const, u: U[i], f: U[i] / 2 })), ...right.map((l, i) => ({ l, side: 1 as const, u: U[i], f: 0.5 + U[i] / 2 }))];
  return (
    <svg viewBox="0 0 640 320" className="paper-fig" role="img" aria-labelledby="ff-t">
      <title id="ff-t">Figure 1. The Fettle flywheel: process mining on the left, Claude Code on the right, a token looping through both.</title>
      <path d={d} fill="none" style={LINE} strokeWidth="12" />
      <path d={d} fill="none" style={ACTS} strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="2 10">
        {!m && <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="2.4s" repeatCount="indefinite" />}
      </path>
      <text x={c1} y={cy - 4} textAnchor="middle" className="pf-hub" style={INK}>Process mining</text>
      <text x={c1} y={cy + 16} textAnchor="middle" className="pf-sub" style={INK2}>finds where work waits</text>
      <text x={c2} y={cy - 4} textAnchor="middle" className="pf-hub" style={INK}>Claude Code</text>
      <text x={c2} y={cy + 16} textAnchor="middle" className="pf-sub" style={INK2}>drafts the fix</text>
      {stations.map((s) => {
        const [x, y] = pt(s.side, s.u, r), [lx, ly] = pt(s.side, s.u, r + 24);
        const anchor = Math.abs(lx - x) < 6 ? "middle" : lx > x ? "start" : "end";
        return (
          <g key={s.l}>
            <circle cx={x} cy={y} r="8" style={{ ...CARD, ...ACTS }} strokeWidth="2.5" />
            <circle cx={x} cy={y} r="8" style={ACT} opacity={m ? 1 : 0}>{!m && lit(s.f, dur)}</circle>
            {s.l === "human review" ? (
              <>
                <text x={lx} y={ly + 4} textAnchor={anchor} className="pf-lbl pf-wide" style={INK}>{s.l}</text>
                <text x={lx} y={ly + 4} textAnchor={anchor} className="pf-lbl pf-narrow" style={INK}>review</text>
              </>
            ) : <text x={lx} y={ly + 4} textAnchor={anchor} className="pf-lbl" style={INK}>{s.l}</text>}
          </g>
        );
      })}
      {!m && [0, 0.012, 0.024, 0.036].map((lag, k) => (
        <circle key={k} r={k ? 5 - k : 7.5} style={ACT} opacity={k ? 0.55 - k * 0.12 : 1}>
          <animateMotion path={d} dur={`${dur}s`} begin={`${(-dur + lag * dur).toFixed(2)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ Toast */
export function ToastFigure() {
  const m = still(), dur = 8;
  const xs = [64, 192, 320, 448, 576];
  const stop = ["Supplier", "Receive", "Store", "Bar", "Cup"];
  const sub = ["bag, origin", "lot QR printed", "FIFO bins", "picked FIFO", "sold, ORD-5531"];
  const audit = ["received", "lot L-0718", "moved to bin", "oldest first", "lot → order"];
  const run = 0.82; // fraction of the loop spent moving; then it holds, so the ledger can be read
  const f = (i: number) => (i / (xs.length - 1)) * run;
  return (
    <svg viewBox="0 0 640 320" className="paper-fig" role="img" aria-labelledby="tf-t">
      <title id="tf-t">Figure 1. Toast traces a lot from supplier to cup; every move writes an audit entry.</title>
      <text x="16" y="44" className="pf-lane" style={INK2}>LOT</text>
      <line x1={xs[0]} y1="92" x2={xs[4]} y2="92" style={LINE} strokeWidth="10" strokeLinecap="round" />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="92" r="17" style={{ ...CARD, ...ACTS }} strokeWidth="2.5" />
          <circle cx={x} cy="92" r="17" style={ACT} opacity={m ? 1 : 0}>{!m && lit(f(i), dur)}</circle>
          <text x={x} y="97" textAnchor="middle" className="pf-num" style={{ fill: "var(--card)" }}>{i + 1}</text>
          <text x={x} y="134" textAnchor="middle" className="pf-lbl" style={INK}>{stop[i]}</text>
          <text x={x} y="152" textAnchor="middle" className="pf-sub" style={INK2}>{sub[i]}</text>
        </g>
      ))}
      {!m && (
        <rect x="-9" y="-9" width="18" height="18" rx="3" style={{ fill: "var(--text)" }}>
          <animateMotion path={`M${xs[0]},62 L${xs[4]},62`} keyPoints="0;1;1" keyTimes={`0;${run};1`} calcMode="linear" dur={`${dur}s`} repeatCount="indefinite" />
        </rect>
      )}
      <text x="16" y="198" className="pf-lane" style={INK2}>AUDIT TRAIL</text>
      <line x1="16" y1="206" x2="624" y2="206" style={LINE} strokeWidth="1" />
      {xs.map((x, i) => (
        <g key={"a" + x} opacity={m ? 1 : 0}>
          {!m && lit(f(i) + 0.01, dur)}
          <rect x={x - 52} y="218" width="104" height="40" rx="7" style={{ fill: "var(--act-tint)", ...ACTS }} strokeWidth="1" />
          <text x={x} y="236" textAnchor="middle" className="pf-sub" style={INK}>{audit[i]}</text>
          <text x={x} y="251" textAnchor="middle" className="pf-tiny" style={INK2}>✓ who · when</text>
        </g>
      ))}
      <text x="320" y="296" textAnchor="middle" className="pf-sub" style={INK2}>an AI change waits here until a person approves it</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ Nexus */
export function NexusFigure() {
  const m = still(), dur = 6;
  const cols: [number, string, string, number][] = [
    [62, "Sources", "DBs · APIs · files", 0.12], [178, "Kafka", "+ Debezium", 0.22],
    [292, "Bronze", "every event", 0.32], [404, "Silver", "newest wins", 0.48],
    [514, "Gold", "certified", 0.7], [604, "Serve", "BI · agents", 0.12],
  ];
  return (
    <svg viewBox="0 0 640 320" className="paper-fig" role="img" aria-labelledby="nf-t">
      <title id="nf-t">Figure 1. Nexus: change events stream from sources through Kafka into Bronze, Silver and Gold; replays are dropped at Silver.</title>
      {cols.map(([x, l, s, o], i) => (
        <g key={l}>
          <rect x={x - (i === 5 ? 30 : 46)} y="70" width={i === 5 ? 60 : 92} height="120" rx="12" style={{ fill: "var(--act)", ...ACTS }} fillOpacity={o} strokeOpacity=".5" />
          <text x={x} y="218" textAnchor="middle" className="pf-lbl" style={INK}>{l}</text>
          <text x={x} y="236" textAnchor="middle" className="pf-sub" style={INK2}>{s}</text>
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <circle key={k} r="5.5" style={INK} cx={m ? 120 + k * 80 : 0} cy={m ? 112 + (k % 3) * 18 : 0}>
          {!m && <animateMotion path={`M20,${112 + (k % 3) * 18} L620,${112 + (k % 3) * 18}`} dur={`${dur}s`} begin={`${(-k * dur) / 6}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      {!m && (
        <g>
          <circle r="5.5" style={{ fill: "var(--bad)" }}>
            <animateMotion path="M20,166 L404,166" dur={`${dur}s`} begin="-1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.62;0.68;1" dur={`${dur}s`} begin="-1.5s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
      <text x="404" y="56" textAnchor="middle" className="pf-sub" style={{ fill: "var(--bad)" }}>replay dropped</text>
      <text x="514" y="56" textAnchor="middle" className="pf-sub" style={INK2}>3σ gate</text>
      <text x="320" y="282" textAnchor="middle" className="pf-sub" style={INK2}>every record traceable to its source, load time and batch</text>
    </svg>
  );
}
