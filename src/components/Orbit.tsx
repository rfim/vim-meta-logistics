import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* The flywheel, three ways. One engine: a closed SVG path, eight stations along it, and a token with a
   comet tail that travels one lap per "turn". Labels are pills placed outside the path, so nothing overlaps. */

export type Style = "eight" | "ring" | "track";
type Group = "mine" | "claude";
type Geo = { w: number; h: number; d: string; f: number[]; out: (i: number, x: number, y: number) => [number, number]; centre?: [number, number] };

export const STATIONS: [string, Group][] = [
  ["event log", "mine"], ["discover", "mine"], ["conform", "mine"], ["find the wait", "mine"],
  ["context", "claude"], ["draft", "claude"], ["human review", "claude"], ["feedback", "claude"],
];
const unit = (dx: number, dy: number): [number, number] => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

function geometry(style: Style, narrow: boolean): Geo {
  const F8 = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9];
  if (style === "eight") {
    if (!narrow) {
      // left loop (mining) anticlockwise from the crossing, then right loop (Claude Code) clockwise
      const r = 130, cx = 360, cy = 200, L: [number, number] = [cx - r, cy], R: [number, number] = [cx + r, cy];
      return { w: 720, h: 400, f: F8,
        d: `M${cx},${cy} A${r},${r} 0 1,0 ${cx - 2 * r},${cy} A${r},${r} 0 1,0 ${cx},${cy} A${r},${r} 0 1,1 ${cx + 2 * r},${cy} A${r},${r} 0 1,1 ${cx},${cy}`,
        out: (i, x, y) => unit(x - (i < 4 ? L : R)[0], y - (i < 4 ? L : R)[1]) };
    }
    const r = 118, cx = 180, cy = 300, T: [number, number] = [cx, cy - r], B: [number, number] = [cx, cy + r];
    return { w: 360, h: 600, f: F8,
      d: `M${cx},${cy} A${r},${r} 0 1,1 ${cx},${cy - 2 * r} A${r},${r} 0 1,1 ${cx},${cy} A${r},${r} 0 1,0 ${cx},${cy + 2 * r} A${r},${r} 0 1,0 ${cx},${cy}`,
      out: (i, x, y) => unit(x - (i < 4 ? T : B)[0], y - (i < 4 ? T : B)[1]) };
  }
  if (style === "ring") {
    const w = narrow ? 360 : 720, h = narrow ? 400 : 420, cx = w / 2, cy = h / 2, r = narrow ? 120 : 150;
    return { w, h, centre: [cx, cy], f: STATIONS.map((_, i) => (i + 0.5) / 8),
      d: `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx},${cy + r} A${r},${r} 0 1,1 ${cx},${cy - r}`,
      out: (_, x, y) => unit(x - cx, y - cy) };
  }
  // track
  if (!narrow) {
    // stations only on the straights: top runs 0 → 0.311, bottom runs 0.5 → 0.811
    const x0 = 140, x1 = 580, y0 = 120, y1 = 290, rr = (y1 - y0) / 2;
    return { w: 720, h: 400, f: [0.04, 0.12, 0.2, 0.28, 0.54, 0.62, 0.7, 0.78],
      d: `M${x0},${y0} L${x1},${y0} A${rr},${rr} 0 0,1 ${x1},${y1} L${x0},${y1} A${rr},${rr} 0 0,1 ${x0},${y0}`,
      out: (_, _x, y) => (y < (y0 + y1) / 2 ? [0, -1] : [0, 1]) as [number, number] };
  }
  const x0 = 140, x1 = 260, y0 = 70, y1 = 570, rr = (x1 - x0) / 2;
  return { w: 400, h: 640, f: [0.04, 0.13, 0.22, 0.31, 0.54, 0.63, 0.72, 0.81],
    d: `M${x1},${y0} L${x1},${y1} A${rr},${rr} 0 0,1 ${x0},${y1} L${x0},${y0} A${rr},${rr} 0 0,1 ${x1},${y0}`,
    out: (_, x) => (x > 200 ? [1, 0] : [-1, 0]) as [number, number] };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Orbit({ style, laps, fit, onLap }: { style: Style; laps: number; fit: number; onLap: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [len, setLen] = useState(0);
  const [pts, setPts] = useState<[number, number][]>([]);
  const [pos, setPos] = useState(0); // 0..1 along the lap
  const [moving, setMoving] = useState(false);
  const g = geometry(style, narrow);

  useEffect(() => {
    const ro = new ResizeObserver(() => setNarrow((box.current?.clientWidth || 999) < 560));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const p = pathRef.current; if (!p) return;
    const L = p.getTotalLength(); setLen(L);
    setPts(g.f.map((f) => { const q = p.getPointAtLength(f * L); return [q.x, q.y]; }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, narrow]);

  // One lap per change of `laps`
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setPos(0); onLap(); return; }
    let raf = 0; const t0 = performance.now(), dur = 3600;
    setMoving(true);
    const f = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setPos(ease(k));
      if (k < 1) raf = requestAnimationFrame(f); else { setMoving(false); setPos(0); onLap(); }
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laps]);

  // Seek hook for recording preview frames deterministically (no effect unless called)
  useEffect(() => {
    (window as unknown as { __orbitSeek?: (p: number) => void }).__orbitSeek = (p: number) => { setMoving(p > 0 && p < 1); setPos(p > 0 && p < 1 ? ease(p) : 0); };
  }, []);

  const tok = pathRef.current && len ? pathRef.current.getPointAtLength(pos * len) : null;
  const trail = Math.min(len * 0.16, pos * len);
  const reached = (i: number) => moving && pos >= g.f[i] - 0.005;
  const active = moving ? g.f.reduce((a, f, i) => (pos >= f - 0.005 ? i : a), -1) : -1;
  const fs = narrow ? 13 : 12.5;

  return (
    <div ref={box} className="orbit">
      <svg viewBox={`0 0 ${g.w} ${g.h}`} className="diagram" role="img" aria-labelledby="orb-t orb-d">
        <title id="orb-t">The Fettle flywheel: process mining and Claude Code</title>
        <desc id="orb-d">A closed loop of eight steps. Process mining: event log, discover, conform, find the wait. Claude Code: context, draft, human review, feedback. A person approves every change, and the approved fix produces a new log to mine.</desc>
        <defs>
          <filter id="orb-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <linearGradient id="orb-tail" x1="0" x2="1"><stop offset="0" stopColor="var(--act)" stopOpacity="0" /><stop offset="1" stopColor="var(--act)" /></linearGradient>
        </defs>
        {/* base track and a slow flowing dash, so the loop feels alive even at rest */}
        <path ref={pathRef} d={g.d} fill="none" stroke="var(--line)" strokeWidth={10} strokeLinejoin="round" />
        <path d={g.d} fill="none" stroke="var(--act)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 12" className="orb-flow" />
        {/* comet tail */}
        {moving && len > 0 && (
          <path d={g.d} fill="none" stroke="var(--act)" strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${trail} ${len}`} strokeDashoffset={-(pos * len - trail)} opacity={0.85} />
        )}
        {/* ring style: fitness gauge in the centre */}
        {g.centre && (() => {
          const [cx, cy] = g.centre, r = narrow ? 70 : 86, C = 2 * Math.PI * r;
          return (
            <g>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={8} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={fit >= 0.8 ? "var(--act)" : "var(--bad)"} strokeWidth={8} strokeLinecap="round"
                strokeDasharray={`${fit * C} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,.7,.2,1)" }} />
              <text x={cx} y={cy + 2} textAnchor="middle" className="lbl" style={{ fontSize: narrow ? 26 : 32, fontWeight: 800 }}>{fit.toFixed(2)}</text>
              <text x={cx} y={cy + 24} textAnchor="middle" className="sub" style={{ fontSize: 11 }}>process fitness</text>
            </g>
          );
        })()}
        {/* hub labels */}
        {style === "eight" && (narrow
          ? <><text x={180} y={186} textAnchor="middle" className="lbl" style={{ fontSize: 15 }}>Process mining</text><text x={180} y={422} textAnchor="middle" className="lbl" style={{ fontSize: 15 }}>Claude Code</text></>
          : <><text x={230} y={205} textAnchor="middle" className="lbl" style={{ fontSize: 16 }}>Process mining</text><text x={490} y={205} textAnchor="middle" className="lbl" style={{ fontSize: 16 }}>Claude Code</text></>)}
        {style === "track" && (narrow
          ? <><text x={200} y={320} textAnchor="middle" className="lbl" style={{ fontSize: 14 }} transform="rotate(-90 200 320)">mining ↓ · ↑ Claude Code</text></>
          : <><text x={360} y={200} textAnchor="middle" className="lbl" style={{ fontSize: 15 }}>Process mining →</text><text x={360} y={222} textAnchor="middle" className="lbl" style={{ fontSize: 15 }}>← Claude Code</text></>)}
        {/* stations: dot on the path + pill label outside */}
        {pts.map(([x, y], i) => {
          const [ux, uy] = g.out(i, x, y), [label, grp] = STATIONS[i];
          const lit = reached(i), on = i === active;
          const tw = label.length * fs * 0.56 + 18, th = fs + 12, gap = 22;
          const lx = x + ux * (gap + (Math.abs(ux) > 0.6 ? tw / 2 : 0)), ly = y + uy * (gap + (Math.abs(uy) > 0.6 ? th / 2 : 4));
          return (
            <g key={i} className={"orb-st" + (on ? " on" : "")}>
              <circle cx={x} cy={y} r={on ? 11 : 8} fill={lit ? (grp === "mine" ? "var(--act)" : "var(--text)") : "var(--card)"}
                stroke={grp === "mine" ? "var(--act)" : "var(--text-2)"} strokeWidth={2.5} style={{ transition: "r .25s, fill .25s" }} />
              <rect x={lx - tw / 2} y={ly - th / 2} width={tw} height={th} rx={th / 2}
                fill={on ? "var(--act)" : "var(--card)"} stroke={on ? "var(--act)" : "var(--line)"} style={{ transition: "fill .25s, stroke .25s" }} />
              <text x={lx} y={ly + fs * 0.36} textAnchor="middle" style={{ fontSize: fs, fontWeight: 600, fill: on ? "#fff" : grp === "mine" ? "var(--act)" : "var(--text)", transition: "fill .25s" }}>{label}</text>
            </g>
          );
        })}
        {/* token */}
        {moving && tok && <circle cx={tok.x} cy={tok.y} r={9} fill="var(--act)" filter="url(#orb-glow)" />}
      </svg>
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: "var(--act)" }} />process mining</span>
        <span><i style={{ background: "var(--text)" }} />Claude Code</span>
        <span>A person approves every change before it ships.</span>
      </div>
    </div>
  );
}
