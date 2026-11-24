// Small looping animations for the three product cards on the Story hero.
// SVG + SMIL animateMotion (user units, no layout cost). Static when the visitor prefers reduced motion.
const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const SKY = "#4BA9FE", DIM = "rgba(255,255,255,.22)", INK = "#DDE3E8", OFF = "#1C2B33";

/** Fettle: a token loops the flywheel, mine ↔ fix */
export function FettleArt() {
  const d = "M120,40 A28,28 0 1,0 64,40 A28,28 0 1,0 120,40 A28,28 0 1,1 176,40 A28,28 0 1,1 120,40";
  const m = still();
  return (
    <svg viewBox="0 0 240 80" className="b3-art" role="img" aria-label="The Fettle flywheel: process mining and fixing, in a loop">
      <path d={d} fill="none" stroke={DIM} strokeWidth="6" />
      <path d={d} fill="none" stroke={SKY} strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="2 8">
        {!m && <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite" />}
      </path>
      <text x="92" y="44" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">mine</text>
      <text x="148" y="44" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">fix</text>
      {[0, 0.12, 0.24].map((lag, k) => (
        <circle key={k} r={k ? 3.5 - k : 5.5} fill={SKY} opacity={k ? 0.5 - k * 0.15 : 1} cx={m ? 64 : 0} cy={m ? 40 : 0}>
          {!m && <animateMotion path={d} dur="4.8s" begin={`-${lag * 4.8}s`} repeatCount="indefinite" rotate="auto" />}
        </circle>
      ))}
    </svg>
  );
}

/** Toast: a lot travels supplier → lot → venue → cup; each stop lights as it passes */
export function ToastArt() {
  const xs = [26, 92, 158, 218], labels = ["supplier", "lot", "venue", "cup"], dur = 4.4, m = still();
  const f = (x: number) => (x - xs[0]) / (xs[3] - xs[0]);
  return (
    <svg viewBox="0 0 240 80" className="b3-art" role="img" aria-label="Toast traceability: supplier, lot, venue, cup, every move traced">
      <line x1={xs[0]} y1="32" x2={xs[3]} y2="32" stroke={DIM} strokeWidth="4" strokeLinecap="round" />
      {xs.map((x, i) => {
        const t = Math.min(0.96, f(x) * 0.8);
        return (
          <g key={x}>
            <circle cx={x} cy="32" r="9" fill={m ? SKY : OFF} stroke={SKY} strokeWidth="2">
              {!m && <animate attributeName="fill" values={`${OFF};${OFF};${SKY};${SKY};${OFF}`} keyTimes={`0;${t.toFixed(3)};${(t + 0.03).toFixed(3)};0.92;1`} dur={`${dur}s`} repeatCount="indefinite" />}
            </circle>
            <text x={x} y="60" textAnchor="middle" fill={INK} fontSize="12" fontWeight="600">{labels[i]}</text>
          </g>
        );
      })}
      <text x={xs[1]} y="36" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="800">QR</text>
      <circle r="4.5" fill="#fff" cx={m ? xs[3] : 0} cy={m ? 32 : 0}>
        {!m && <animateMotion path={`M${xs[0]},32 L${xs[3]},32`} keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear" dur={`${dur}s`} repeatCount="indefinite" />}
      </circle>
      <text x="120" y="76" textAnchor="middle" fill={SKY} fontSize="10.5" fontWeight="600">every move traced · who touched it last</text>
    </svg>
  );
}

/** Nexus: change events stream from Kafka through Bronze → Silver → Gold; a duplicate is dropped at Silver */
export function NexusArt() {
  const cols: [number, string][] = [[24, "Kafka"], [90, "Bronze"], [152, "Silver"], [214, "Gold"]], m = still();
  const op = [0.25, 0.35, 0.5, 0.7];
  return (
    <svg viewBox="0 0 240 80" className="b3-art" role="img" aria-label="Nexus: events stream from Kafka into Bronze, Silver and Gold; duplicates are dropped at Silver">
      {cols.map(([x, l], i) => (
        <g key={l}>
          <rect x={x - 20} y="14" width="40" height="34" rx="7" fill={SKY} fillOpacity={op[i]} stroke={SKY} strokeOpacity=".6" />
          <text x={x} y="62" textAnchor="middle" fill={INK} fontSize="12" fontWeight="600">{l}</text>
        </g>
      ))}
      {[0, 1, 2, 3].map((k) => (
        <circle key={k} r="3.5" fill="#fff" cx={m ? 90 + k * 8 : 0} cy={m ? 31 : 0}>
          {!m && <animateMotion path="M10,31 L226,31" dur="3.2s" begin={`${-k * 0.8}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      {!m && (
        <circle r="3.5" fill="#FB7D87">
          <animateMotion path="M10,24 L152,24" dur="3.2s" begin="-0.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.6;0.66;1" dur="3.2s" begin="-0.4s" repeatCount="indefinite" />
        </circle>
      )}
      <text x="120" y="76" textAnchor="middle" fill={SKY} fontSize="10.5" fontWeight="600">replays dropped · newest change wins</text>
    </svg>
  );
}
