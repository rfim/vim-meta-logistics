import type { CSSProperties, ReactNode } from "react";

/* The intro for each Spares back-office: what the business problem is, what the tool does, the expected
   result, and how to try it, with a small looping animation of the tool at work beside the text.
   SVG + SMIL; colours follow the theme; still for reduced motion. */

const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const st = (o: CSSProperties) => o;
const ACT = st({ fill: "var(--act)" }), CARD = st({ fill: "var(--card)" }), INK = st({ fill: "var(--text)" }), INK2 = st({ fill: "var(--text-2)" });
const LINE = st({ stroke: "var(--line)" }), BAD = st({ fill: "var(--bad)" }), GOOD = st({ fill: "var(--good)" });
const fade = (on: number, off: number, dur: number) => <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={`0;${on.toFixed(3)};${(on + 0.02).toFixed(3)};${off.toFixed(3)};${(off + 0.02).toFixed(3)};1`} dur={`${dur}s`} repeatCount="indefinite" />;
const show = (on: number, dur: number) => <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${on.toFixed(3)};${(on + 0.02).toFixed(3)};1`} dur={`${dur}s`} repeatCount="indefinite" />;

export function BackOfficeIntro({ eyebrow, title, id, problem, does, result, tryIt, art }: {
  eyebrow: string; title: string; id: string; problem: ReactNode; does: ReactNode; result: ReactNode; tryIt: ReactNode; art: ReactNode;
}) {
  return (
    <div className="bo-intro">
      <div className="bo-text">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={id + "-h"}>{title}</h2>
        <dl className="bo-blocks">
          <div><dt>The problem</dt><dd>{problem}</dd></div>
          <div><dt>What it does</dt><dd>{does}</dd></div>
          <div className="bo-result"><dt>Expected result</dt><dd>{result}</dd></div>
        </dl>
        <p className="bo-try"><b>Try it:</b> {tryIt}</p>
      </div>
      <div className="bo-art" aria-hidden={false}>{art}</div>
    </div>
  );
}

/* 1 · Approvals inbox: AI checks, a person approves, a rejection reason becomes a rule */
export function InboxArt() {
  const m = still(), d = 9;
  const rows = [["SR-5031", "SSD × 2 · DC-C", "31 h"], ["SR-5032", "NIC (upgrade) · DC-A", "26 h"], ["SR-5033", "PSU × 1 · DC-B", "4 h"]];
  return (
    <svg viewBox="0 0 320 230" className="bo-svg" role="img" aria-label="Approvals inbox: the AI checks a request, a person approves it; another is rejected and the reason becomes a rule">
      {T("INBOX", 12, 18, "bo-cap", INK2)}
      {rows.map(([id, what, age], k) => (
        <g key={id}>
          <rect x="10" y={28 + k * 44} width="200" height="36" rx="8" style={{ ...CARD, ...LINE }} strokeWidth="1.2" />
          {T(id, 20, 44 + k * 44, "bo-b", INK)}{T(what, 20, 57 + k * 44, "bo-s", INK2)}
          {T("⏱ " + age, 202, 44 + k * 44, "bo-s", k < 2 ? BAD : INK2, "end")}
        </g>
      ))}
      {/* row 1: three checks, then approved by a person */}
      {[0, 1, 2].map((j) => <g key={j} opacity={m ? 1 : 0}>{!m && fade(0.08 + j * 0.06, 0.95, d)}<circle cx={130 + j * 16} cy="53" r="6" style={GOOD} />{T("✓", 130 + j * 16, 56, "bo-tick", st({ fill: "#fff" }), "middle")}</g>)}
      <g opacity={m ? 1 : 0}>{!m && fade(0.3, 0.95, d)}<rect x="216" y="30" width="96" height="32" rx="16" style={GOOD} />{T("✓ approved", 264, 50, "bo-b", st({ fill: "#fff" }), "middle")}{T("by a person", 264, 74, "bo-s", INK2, "middle")}</g>
      {/* row 2: one check fails, a person rejects with a reason, the reason becomes a rule */}
      <g opacity={m ? 1 : 0}>{!m && fade(0.42, 0.95, d)}<circle cx="218" cy="98" r="6" style={BAD} />{T("✗", 218, 101, "bo-tick", st({ fill: "#fff" }), "middle")}{T("not like-for-like", 228, 101, "bo-s", BAD)}</g>
      <g opacity={m ? 0 : 1}>
        {!m && fade(0.55, 0.71, d)}
        <g>
          {!m && <animateMotion path="M232,106 L236,166" keyPoints="0;0;1;1" keyTimes="0;0.58;0.7;1" calcMode="linear" dur={`${d}s`} repeatCount="indefinite" />}
          <rect x="0" y="0" width="64" height="20" rx="10" style={{ fill: "var(--act-tint)", stroke: "var(--act)" }} />
          {T("→ rule", 32, 14, "bo-s", INK, "middle")}
        </g>
      </g>
      <rect x="176" y="180" width="136" height="42" rx="10" style={{ ...CARD, stroke: "var(--act)" }} strokeWidth="1.4" />
      {T("RULES THE AI CHECKS", 186, 196, "bo-cap", st({ fill: "var(--act)" }))}
      {T("2", 186, 214, "bo-big", INK)}<g opacity={m ? 1 : 0}>{!m && fade(0.74, 0.95, d)}<rect x="184" y="201" width="16" height="17" style={CARD} />{T("3", 186, 214, "bo-big", st({ fill: "var(--act)" }))}</g>
      {T("oldest wait", 12, 192, "bo-s", INK2)}
      {T("31 h", 12, 214, "bo-big", BAD)}
      <g opacity={m ? 1 : 0}>{!m && fade(0.8, 0.95, d)}<rect x="10" y="199" width="60" height="20" style={CARD} />{T("4 h", 12, 214, "bo-big", st({ fill: "var(--act)" }))}</g>
    </svg>
  );
}

/* 2 · Work orders and RMAs: a card moves to install; a mismatch loops back through an RMA */
export function OrdersArt() {
  const m = still(), d = 10;
  const cols = ["approved", "picked", "shipped", "received"], X = (i: number) => 12 + i * 77;
  // path of the card: across the board, back to "picked" over the top (RMA), then across again
  const path = `M${X(0) + 8},70 L${X(3) + 8},70 L${X(3) + 8},32 L${X(1) + 8},32 L${X(1) + 8},70 L${X(3) + 8},70`;
  return (
    <svg viewBox="0 0 320 230" className="bo-svg" role="img" aria-label="Work orders: a card moves from approved to received; a mismatch at the dock opens an RMA and sends it back to picked, then it is installed">
      {cols.map((c, i) => (
        <g key={c}>
          <rect x={X(i)} y="52" width="70" height="128" rx="8" style={{ fill: "var(--bg-2)", ...LINE }} />
          {T(c, X(i) + 35, 196, "bo-s", INK2, "middle")}
          {T(`SLA ${["4 h", "3 h", "2 h", "18 h"][i]}`, X(i) + 35, 210, "bo-cap", INK2, "middle")}
        </g>
      ))}
      <path d={`M${X(3) + 35},48 C${X(3) + 35},14 ${X(1) + 35},14 ${X(1) + 35},48`} fill="none" stroke="var(--bad)" strokeWidth="1.6" strokeDasharray="4 3" />
      {T("RMA: mismatch at the dock", 160, 14, "bo-s", BAD, "middle")}
      <g transform={m ? `translate(${X(3) + 8},70)` : undefined}>
        <rect x="0" y="0" width="56" height="34" rx="6" style={{ fill: "var(--card)", stroke: "var(--act)" }} strokeWidth="1.6">
          {!m && <animate attributeName="stroke" values="var(--act);var(--act);var(--bad);var(--bad);var(--act);var(--act)" keyTimes="0;0.32;0.33;0.5;0.51;1" dur={`${d}s`} repeatCount="indefinite" />}
        </rect>
        {T("WO-118", 6, 14, "bo-b", INK)}{T("L-0718", 6, 27, "bo-s", INK2)}
        {!m && <animateMotion path={path} keyPoints="0;0.42;0.42;0.62;0.72;1;1" keyTimes="0;0.3;0.36;0.5;0.58;0.82;1" calcMode="linear" dur={`${d}s`} repeatCount="indefinite" />}
      </g>
      <g opacity={m ? 1 : 0}>{!m && fade(0.84, 0.99, d)}<rect x={X(3) - 6} y="120" width="86" height="26" rx="13" style={GOOD} />{T("✓ installed", X(3) + 37, 137, "bo-b", st({ fill: "#fff" }), "middle")}</g>
    </svg>
  );
}

/* 3 · Control tower: stock against reorder point per DC; auto-approve switches on; the wait falls */
export function TowerArt() {
  const m = still(), d = 9;
  const dcs = [["DC-A", 0.82], ["DC-B", 0.74], ["DC-C", 0.62]] as const;
  return (
    <svg viewBox="0 0 320 230" className="bo-svg" role="img" aria-label="Control tower: stock against reorder point for three data centres; DC-C falls below and is flagged; auto-approve switches on and the approval wait drops from 34 hours to 9 minutes">
      {T("STOCK VS REORDER POINT", 12, 18, "bo-cap", INK2)}
      {dcs.map(([dc, h], i) => {
        const x = 24 + i * 66, base = 150, top = base - 110 * h, ropY = base - 110 * 0.5;
        return (
          <g key={dc}>
            <rect x={x} y="40" width="36" height="110" rx="6" style={{ fill: "var(--bg-2)" }} />
            <rect x={x} y={top} width="36" height={base - top} rx="6" style={i === 2 ? ACT : ACT} opacity=".85">
              {i === 2 && !m && <animate attributeName="y" values={`${top};${top};${base - 110 * 0.38};${base - 110 * 0.38};${top}`} keyTimes="0;0.15;0.35;0.9;1" dur={`${d}s`} repeatCount="indefinite" />}
              {i === 2 && !m && <animate attributeName="height" values={`${base - top};${base - top};${110 * 0.38};${110 * 0.38};${base - top}`} keyTimes="0;0.15;0.35;0.9;1" dur={`${d}s`} repeatCount="indefinite" />}
              {i === 2 && !m && <animate attributeName="fill" values="var(--act);var(--act);var(--bad);var(--bad);var(--act)" keyTimes="0;0.33;0.35;0.9;1" dur={`${d}s`} repeatCount="indefinite" />}
            </rect>
            <line x1={x - 4} x2={x + 40} y1={ropY} y2={ropY} stroke="var(--text)" strokeWidth="1.4" strokeDasharray="4 3" />
            {T(dc, x + 18, 166, "bo-s", INK2, "middle")}
          </g>
        );
      })}
      {T("ROP", 1, 98, "bo-cap", INK)}
      <g opacity={m ? 1 : 0}>{!m && fade(0.36, 0.9, d)}{T("⚠ reorder", 156, 186, "bo-b", BAD)}</g>
      {/* approval policy */}
      {T("AUTO-APPROVE", 222, 30, "bo-cap", INK2)}
      <rect x="222" y="38" width="44" height="22" rx="11" style={{ fill: "var(--line)" }}>
        {!m && <animate attributeName="fill" values="var(--line);var(--line);var(--act);var(--act);var(--line)" keyTimes="0;0.5;0.52;0.95;1" dur={`${d}s`} repeatCount="indefinite" />}
      </rect>
      <circle cx="233" cy="49" r="8" style={CARD}>
        {!m && <animate attributeName="cx" values="233;233;255;255;233" keyTimes="0;0.5;0.52;0.95;1" dur={`${d}s`} repeatCount="indefinite" />}
      </circle>
      {T("approval p75", 222, 82, "bo-s", INK2)}
      <g>{!m && fade(0, 0.58, d)}{T("34 h", 222, 106, "bo-big", BAD)}</g>
      <g opacity={m ? 1 : 0}>{!m && fade(0.6, 0.95, d)}{T("9 min", 222, 106, "bo-big", st({ fill: "var(--act)" }))}</g>
      {T("re-mined from the", 222, 124, "bo-s", INK2)}{T("tower's own log", 222, 137, "bo-s", INK2)}
    </svg>
  );
}

/* 4 · Asset source of truth: the path to a component lights up; it fails; a spare from a known lot replaces it */
export function AssetsArt() {
  const m = still(), d = 9;
  const nodes = ["DC-C", "Hall 2", "Rack R14", "srv-0412", "SSD slot 3"];
  return (
    <svg viewBox="0 0 320 230" className="bo-svg" role="img" aria-label="Asset source of truth: data centre, hall, rack, server and component; the SSD fails and a spare from lot L-0718 is installed, with who touched it last">
      {T("WHERE IS IT?", 12, 18, "bo-cap", INK2)}
      {nodes.map((n, i) => {
        const x = 14 + i * 16, y = 30 + i * 32;
        return (
          <g key={n}>
            {i > 0 && <path d={`M${x - 8},${y - 18} L${x - 8},${y + 2} L${x},${y + 2}`} fill="none" stroke="var(--line)" strokeWidth="1.5" />}
            <rect x={x} y={y - 9} width={150 - i * 6} height="24" rx="6" style={{ ...CARD, ...LINE }} />
            <rect x={x} y={y - 9} width={150 - i * 6} height="24" rx="6" fill="none" stroke="var(--act)" strokeWidth="2" opacity={m ? 1 : 0}>{!m && show(0.06 + i * 0.07, d)}</rect>
            {T(n, x + 10, y + 7, i === 4 ? "bo-b" : "bo-s", INK)}
          </g>
        );
      })}
      {/* the component fails, then a spare from a known lot is installed */}
      <g opacity={m ? 0 : 1}>{!m && fade(0.4, 0.62, d)}<rect x="190" y="148" width="120" height="30" rx="8" style={{ fill: "var(--card)", stroke: "var(--bad)" }} strokeWidth="1.6" />{T("✗ failed 09:02", 200, 167, "bo-b", BAD)}</g>
      <g opacity={m ? 1 : 0}>{!m && fade(0.64, 0.97, d)}<rect x="190" y="148" width="120" height="30" rx="8" style={{ fill: "var(--card)", stroke: "var(--good)" }} strokeWidth="1.6" />{T("✓ spare from L-0718", 200, 167, "bo-b", GOOD)}</g>
      <g opacity={m ? 1 : 0}>{!m && fade(0.68, 0.97, d)}
        {T("who touched it last", 190, 196, "bo-s", INK2)}{T("tech:ana · 11:40", 190, 210, "bo-b", INK)}
      </g>
      {T("history kept (SCD2): where it was at any moment", 12, 222, "bo-s", INK2)}
    </svg>
  );
}

function T(t: string, x: number, y: number, cls: string, style: CSSProperties, anchor: "start" | "middle" | "end" = "start") {
  return <text x={x} y={y} textAnchor={anchor} className={cls} style={style}>{t}</text>;
}
