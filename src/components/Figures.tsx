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
// Same dark-plate language as the Nexus figure. A lot rides the rail from supplier to cup and every
// move writes a ledger entry; an AI-proposed change waits for a person before it is written.
export function ToastFigure() {
  const m = still(), dur = 10;
  const P = { bg: "#0F191E", card: "#152127", line: "#2B3D46", ink: "#F1F4F7", mute: "#A7B3BF", dim: "#5D6C7B", ok: "#3CBC22", wait: "#FBCE03", sky: "#4BA9FE", bad: "#FB7D87" };
  const cards: [string, string, string, string][] = [
    ["01 / SOURCE", "Supplier", "approved vendor", "bag, origin"],
    ["02 / RECEIVE", "Receive", "lot QR printed", "L-0718 · 24 kg"],
    ["03 / STORE", "Store", "FIFO bins", "oldest first"],
    ["04 / SERVE", "Bar", "picked, scanned", "per drink"],
    ["05 / SELL", "Cup", "lot → order", "ORD-5531"],
  ];
  const X = (i: number) => 16 + i * 122, W = 112, RAIL = 168, cx = (i: number) => X(i) + W / 2;
  const run = 0.62; // the lot travels for 62% of the loop, then holds so the ledger can be read
  const at = (i: number) => (i / 4) * run;
  const T = (t: string, x: number, y: number, cls: string, fill: string, anchor: "start" | "middle" | "end" = "start") =>
    <text x={x} y={y} textAnchor={anchor} className={cls} style={{ fill }}>{t}</text>;
  const show = (f: number) => !m && <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${f.toFixed(3)};${(f + 0.01).toFixed(3)};1`} dur={`${dur}s`} repeatCount="indefinite" />;
  return (
    <svg viewBox="0 0 640 320" className="paper-fig nexus-plate" role="img" aria-labelledby="tf-t">
      <title id="tf-t">Figure 1. Toast: a lot travels from supplier to cup and every move writes an audit entry; an AI-proposed change waits for a person's approval before it is written.</title>
      <rect x="0" y="0" width="640" height="320" rx="14" fill={P.bg} />
      {T("EVERY MOVE TRACED. NO CHANGE UNSEEN.", 18, 26, "pf-lane", P.sky)}
      <circle cx="470" cy="22" r="4" fill={P.ok} />{T("TRACED", 478, 26, "pf-tiny", P.mute)}
      <circle cx="534" cy="22" r="4" fill={P.wait} />{T("AI CHANGE", 542, 26, "pf-tiny", P.mute)}
      <defs><marker id="tx-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={P.mute} /></marker></defs>
      {cards.map(([tag, title, tech, sub], i) => (
        <g key={title}>
          <rect x={X(i)} y="40" width={W} height="96" rx="10" fill={P.card} stroke={P.line} strokeWidth="1" />
          <rect x={X(i)} y="40" width={W} height="96" rx="10" fill="none" stroke={P.sky} strokeWidth="1.8" opacity={m ? 1 : 0}>{show(at(i))}</rect>
          {T(tag, X(i) + 10, 58, "pf-tiny", P.mute)}
          <circle cx={X(i) + 14} cy="72" r="4" fill={P.dim} />
          <circle cx={X(i) + 14} cy="72" r="4" fill={P.sky} opacity={m ? 1 : 0}>{show(at(i))}</circle>
          {T(title, X(i) + 10, 96, "pf-lbl nx-title", P.ink)}
          {T(tech, X(i) + 10, 114, "pf-sub", P.sky)}
          {T(sub, X(i) + 10, 128, "pf-tiny", P.dim)}
          {i < 4 && <path d={`M${X(i) + W + 1},88 l7,0`} stroke={P.mute} strokeWidth="1.5" markerEnd="url(#tx-ar)" />}
          <line x1={cx(i)} y1="136" x2={cx(i)} y2={RAIL} stroke={P.line} strokeWidth="1.5" />
        </g>
      ))}
      <line x1={cx(0)} y1={RAIL} x2={cx(4)} y2={RAIL} stroke={P.line} strokeWidth="3" strokeLinecap="round" />
      {([[cx(1), "QR"], [cx(2), "F"], [cx(4), "✓"]] as [number, string][]).map(([x, t]) => (
        <g key={t}><circle cx={x} cy={RAIL} r="10" fill={P.bg} stroke={P.ok} strokeWidth="2" />{T(t, x, RAIL + 4, "pf-num nx-mark", P.ok, "middle")}</g>
      ))}
      {/* the lot */}
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill={P.ink} transform={m ? `translate(${cx(4)},${RAIL})` : undefined}>
        {!m && <animateMotion path={`M${cx(0)},${RAIL} L${cx(4)},${RAIL}`} keyPoints="0;1;1" keyTimes={`0;${run};1`} calcMode="linear" dur={`${dur}s`} repeatCount="indefinite" />}
      </rect>
      {/* audit trail: one ledger entry per move */}
      {T("AUDIT TRAIL", 18, 204, "pf-tiny nx-strong", P.mute)}
      {cards.map(([, title], i) => (
        <g key={"l" + title} opacity={m ? 1 : 0}>
          {show(at(i) + 0.01)}
          <rect x={X(i) + 4} y="212" width={W - 8} height="26" rx="6" fill={P.card} stroke={P.ok} strokeOpacity=".7" />
          {T("✓ " + ["received", "lot printed", "moved to bin", "picked FIFO", "sold"][i], X(i) + 12, 229, "pf-tiny nx-strong pf-wide", P.ok)}
          {T("✓", X(i) + W / 2, 231, "pf-narrow nx-keep", P.ok, "middle")}
        </g>
      ))}
      {/* an AI-proposed change waits for a person, then is written */}
      <g opacity={m ? 1 : 0}>
        {show(0.66)}
        <rect x="16" y="252" width="230" height="30" rx="15" fill={P.card} stroke={P.wait} />
        {T("AI assistant: price 24.50 → 25.00", 30, 271, "pf-tiny nx-strong", P.wait)}
        <path d="M250,267 l30,0" stroke={P.mute} strokeWidth="1.5" markerEnd="url(#tx-ar)" />
        <rect x="286" y="252" width="168" height="30" rx="15" fill={P.card} stroke={P.wait}>
          {!m && <animate attributeName="stroke" values={`${P.wait};${P.wait};${P.ok};${P.ok}`} keyTimes="0;0.84;0.86;1" dur={`${dur}s`} repeatCount="indefinite" />}
        </rect>
        {T("HUMAN APPROVAL", 300, 271, "pf-tiny nx-strong pf-wide", P.ink)}
        {T("APPROVE", 300, 272, "pf-narrow nx-keep", P.ink)}
        <circle cx="436" cy="267" r="8" fill={P.ok} opacity={m ? 1 : 0}>{show(0.85)}</circle>
        {T("✓", 436, 271, "pf-tiny nx-strong", P.bg, "middle")}
        <path d="M458,267 l30,0" stroke={P.mute} strokeWidth="1.5" markerEnd="url(#tx-ar)" />
        <g opacity={m ? 1 : 0}>{show(0.87)}{T("written to the trail", 494, 271, "pf-tiny nx-strong", P.ok)}</g>
      </g>
      {T("WHERE IT IS · WHO TOUCHED IT LAST · WHAT IT'S WAITING FOR", 18, 306, "pf-tiny nx-strong", P.mute)}
      {T("BY VIM", 622, 306, "pf-tiny nx-strong", P.sky, "end")}
    </svg>
  );
}

/* ------------------------------------------------------------------ Nexus */
// Drawn as a dark plate, in the style of the NEXUS diagrams in my GitHub README:
// "one bad row, no blocked batch". Two good rows publish; one bad row waits in quarantine
// with its reason, is corrected, and replays safely. The batch never stops.
const N = { bg: "#0F191E", card: "#152127", line: "#2B3D46", ink: "#F1F4F7", mute: "#A7B3BF", dim: "#5D6C7B", ok: "#3CBC22", bad: "#FB7D87", sky: "#4BA9FE" };
export function NexusFigure() {
  const m = still(), dur = 9;
  const cards: [string, string, string, string, boolean][] = [
    ["01 / INPUT", "Sources", "Postgres · APIs", "source events", false],
    ["02 / CDC", "Capture", "Debezium · Kafka", "ordered changes", false],
    ["03 / MODEL", "Lakehouse", "Databricks · Delta", "Bronze/Silver/Gold", true],
    ["04 / TRUST", "Validate", "contracts, checks", "quality and history", true],
    ["05 / SERVE", "Delivery", "BI · app · agents", "certified models", false],
  ];
  const X = (i: number) => 16 + i * 122, W = 112, RAIL = 184, cx = (i: number) => X(i) + W / 2;
  const QX = cx(3), PX = cx(4);
  // the bad row: along the rail to Validate, down into quarantine, wait, back up, on to publish
  const badPath = `M24,${RAIL} L${QX},${RAIL} L${QX},236 L${QX},${RAIL} L${PX},${RAIL} L${PX},236`;
  const L1 = QX - 24, L2 = 236 - RAIL, L3 = PX - QX, tot = L1 + 2 * L2 + L3 + L2;
  const k = [0, L1, L1 + L2, L1 + L2, L1 + 2 * L2, L1 + 2 * L2 + L3, tot, tot].map((v) => (v / tot).toFixed(4)).join(";");
  const T = (t: string, x: number, y: number, cls: string, fill: string, anchor: "start" | "middle" | "end" = "start") =>
    <text x={x} y={y} textAnchor={anchor} className={cls} style={{ fill }}>{t}</text>;
  return (
    <svg viewBox="0 0 640 320" className="paper-fig nexus-plate" role="img" aria-labelledby="nf-t">
      <title id="nf-t">Figure 1. Nexus, one bad row and no blocked batch: two good rows publish; a bad row waits in quarantine with its reason, is corrected, and replays safely.</title>
      <rect x="0" y="0" width="640" height="320" rx="14" fill={N.bg} />
      {T("ONE BAD ROW. NO BLOCKED BATCH.", 18, 26, "pf-lane", N.bad)}
      <circle cx="486" cy="22" r="4" fill={N.ok} />{T("VALID", 494, 26, "pf-tiny", N.mute)}
      <circle cx="546" cy="22" r="4" fill={N.bad} />{T("EXCEPTION", 554, 26, "pf-tiny", N.mute)}
      {cards.map(([tag, title, tech, sub, hot], i) => (
        <g key={title}>
          <rect x={X(i)} y="40" width={W} height="96" rx="10" fill={N.card} stroke={hot ? N.sky : N.line} strokeWidth={hot ? 1.6 : 1} />
          {T(tag, X(i) + 10, 58, "pf-tiny", N.mute)}
          <circle cx={X(i) + 14} cy="72" r="4" fill={hot ? N.sky : N.dim} />
          {T(title, X(i) + 10, 96, "pf-lbl nx-title", N.ink)}
          {T(tech, X(i) + 10, 114, "pf-sub", hot ? N.sky : N.mute)}
          {T(sub, X(i) + 10, 128, "pf-tiny", N.dim)}
          {i < 4 && <path d={`M${X(i) + W + 1},88 l7,0`} stroke={N.mute} strokeWidth="1.5" markerEnd="url(#nx-ar)" />}
          <line x1={cx(i)} y1="136" x2={cx(i)} y2={RAIL} stroke={N.line} strokeWidth="1.5" />
        </g>
      ))}
      <defs><marker id="nx-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={N.mute} /></marker></defs>
      <line x1="24" y1={RAIL} x2={PX} y2={RAIL} stroke={N.line} strokeWidth="3" strokeLinecap="round" />
      {/* rail markers: B = Bronze, ! = the check, A = approved */}
      {([[cx(2), "B", N.ok], [QX - 22, "!", N.bad], [QX + 22, "A", N.ok]] as [number, string, string][]).map(([x, t, c]) => (
        <g key={t}><circle cx={x} cy={RAIL} r="10" fill={N.bg} stroke={c} strokeWidth="2" />{T(t, x, RAIL + 4, "pf-num nx-mark", c, "middle")}</g>
      ))}
      {/* quarantine and published */}
      <line x1={QX} y1={RAIL + 10} x2={QX} y2="218" stroke={N.bad} strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x={QX - 58} y="218" width="116" height="44" rx="9" fill={N.card} stroke={N.bad} strokeWidth="1.6">
        {!m && <animate attributeName="stroke-width" values="1.6;1.6;3;3;1.6;1.6" keyTimes="0;0.36;0.4;0.6;0.64;1" dur={`${dur}s`} repeatCount="indefinite" />}
      </rect>
      {T("QUARANTINE", QX - 48, 236, "pf-tiny nx-strong nx-keep", N.bad)}
      {T("keeps its reason", QX - 48, 252, "pf-tiny", N.mute)}
      <line x1={PX} y1={RAIL} x2={PX} y2="218" stroke={N.ok} strokeWidth="1.5" />
      <rect x={PX - 52} y="218" width="104" height="44" rx="9" fill={N.card} stroke={N.ok} strokeWidth="1.6" />
      {T("PUBLISHED", PX - 42, 236, "pf-tiny nx-strong nx-keep", N.ok)}
      {T("clean records", PX - 42, 252, "pf-tiny", N.mute)}
      {T("GOOD ROWS CONTINUE", 18, 300, "pf-tiny nx-strong", N.mute)}
      {T("EXCEPTIONS WAIT · REPLAY IS SAFE", 270, 300, "pf-tiny nx-strong", N.mute, "middle")}
      {T("BY VIM", 622, 300, "pf-tiny nx-strong", N.sky, "end")}
      {/* two good rows */}
      {[0, 1].map((j) => (
        <circle key={j} r="6.5" fill={N.ok} cx={m ? 120 + j * 160 : 0} cy={m ? RAIL : 0}>
          {!m && <animateMotion path={`M24,${RAIL} L${PX},${RAIL} L${PX},236`} keyPoints="0;1;1" keyTimes={`0;${0.42 + j * 0.06};1`} calcMode="linear" dur={`${dur}s`} begin={`${j * 0.9}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      {/* the bad row: red until it is corrected, then green */}
      <circle r="6.5" fill={N.bad} cx={m ? QX : 0} cy={m ? 236 : 0}>
        {!m && <>
          <animateMotion path={badPath} keyPoints={k} keyTimes="0;0.3;0.36;0.6;0.66;0.82;0.88;1" calcMode="linear" dur={`${dur}s`} begin="0.4s" repeatCount="indefinite" />
          <animate attributeName="fill" values={`${N.bad};${N.bad};${N.ok};${N.ok}`} keyTimes="0;0.6;0.62;1" dur={`${dur}s`} begin="0.4s" repeatCount="indefinite" />
        </>}
      </circle>
    </svg>
  );
}
