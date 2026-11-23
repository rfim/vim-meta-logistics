import { useEffect, useMemo, useRef, useState } from "react";
import { Deck, type Slide } from "../components/Deck";
import { Syn } from "../components/Chrome";
import { R, Sec, tween } from "../components/Bits";
import { PetriNet } from "../components/PetriNet";
import type { PetriSpec, SimConfig } from "../lib/petri";

/* ---------- Reorder point: ROP = μL + zσ√L (synthetic sample) ---------- */
type Row = { part: string; mu: number; sigma: number; L: number; onHand: number };
const DCS: Record<string, Row[]> = {
  "DC-A": [
    { part: "SSD 3.84 TB", mu: 6.2, sigma: 2.1, L: 9, onHand: 71 }, { part: "DIMM 64 GB", mu: 9.5, sigma: 3.4, L: 7, onHand: 88 },
    { part: "PSU 2 kW", mu: 1.4, sigma: 0.8, L: 14, onHand: 26 }, { part: "NIC 100G", mu: 0.9, sigma: 0.6, L: 21, onHand: 16 }, { part: "Fan module", mu: 3.1, sigma: 1.2, L: 5, onHand: 15 },
  ],
  "DC-B": [
    { part: "SSD 3.84 TB", mu: 4.8, sigma: 1.7, L: 9, onHand: 58 }, { part: "DIMM 64 GB", mu: 7.0, sigma: 2.9, L: 7, onHand: 49 },
    { part: "PSU 2 kW", mu: 1.1, sigma: 0.7, L: 14, onHand: 22 }, { part: "NIC 100G", mu: 0.7, sigma: 0.5, L: 21, onHand: 19 }, { part: "Fan module", mu: 2.6, sigma: 1.0, L: 5, onHand: 18 },
  ],
  "DC-C": [
    { part: "SSD 3.84 TB", mu: 8.9, sigma: 3.6, L: 12, onHand: 84 }, { part: "DIMM 64 GB", mu: 11.2, sigma: 4.1, L: 7, onHand: 112 },
    { part: "PSU 2 kW", mu: 1.9, sigma: 1.1, L: 14, onHand: 24 }, { part: "NIC 100G", mu: 1.2, sigma: 0.8, L: 21, onHand: 33 }, { part: "Fan module", mu: 3.8, sigma: 1.5, L: 5, onHand: 21 },
  ],
};
const Z: [string, number][] = [["90%", 1.2816], ["95%", 1.6449], ["99%", 2.3263]];
const rop = (r: Row, z: number, Lx: number) => r.mu * r.L * Lx + z * r.sigma * Math.sqrt(r.L * Lx);

function Rop() {
  const [dc, setDc] = useState("DC-C");
  const [zi, setZi] = useState(1);
  const [lx, setLx] = useState(1);
  const rows = DCS[dc];
  const below = rows.filter((r) => r.onHand < rop(r, Z[zi][1], lx)).length;
  return (
    <div className="split">
      <div>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="seg" role="tablist" aria-label="Data centre">{Object.keys(DCS).map((d) => <button key={d} role="tab" aria-selected={d === dc} onClick={() => setDc(d)}>{d}</button>)}</div>
          <label className="f">Service level
            <select value={zi} onChange={(e) => setZi(+e.target.value)}>{Z.map(([l, z], k) => <option key={l} value={k}>{l} (z = {z.toFixed(2)})</option>)}</select>
          </label>
          <label className="f">Lead time × {lx.toFixed(1)}
            <input type="range" min={0.5} max={2} step={0.1} value={lx} onChange={(e) => setLx(+e.target.value)} aria-valuetext={`${lx.toFixed(1)} times normal lead time`} />
          </label>
        </div>
        <div className="table-wrap"><table>
          <caption className="sr">Reorder points for {dc} at {Z[zi][0]} service level</caption>
          <thead><tr><th>Part</th><th className="num">μ / day</th><th className="num">σ / day</th><th className="num">L (days)</th><th className="num">ROP</th><th className="num">On hand</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => {
            const R0 = rop(r, Z[zi][1], lx), low = r.onHand < R0;
            return <tr key={r.part} className={low ? "below" : ""}><td>{r.part}</td><td className="num">{r.mu}</td><td className="num">{r.sigma}</td><td className="num">{(r.L * lx).toFixed(1)}</td><td className="num"><b>{Math.ceil(R0)}</b></td><td className="num">{r.onHand}</td><td>{low ? "Reorder now" : "OK"}</td></tr>;
          })}</tbody>
        </table></div>
      </div>
      <div className="card" aria-live="polite">
        <p className="formula" aria-label="R O P equals mu L plus z sigma root L">ROP = μL + zσ√L</p>
        <ul className="muted small">
          <li><b>μ</b>: mean daily demand for the part at this site</li><li><b>L</b>: supplier lead time in days</li>
          <li><b>σ</b>: standard deviation of daily demand</li><li><b>z</b>: service level, so 95% means a 5% chance of running out during lead time</li>
        </ul>
        <div className="kpi"><div className="k">Parts below ROP at {dc} <b className={below ? "bad" : "good"}>{below} of {rows.length}</b></div></div>
        <p className="small muted mt">Drag the lead-time slider to see a supplier delay push parts under their reorder point. <Syn /></p>
      </div>
    </div>
  );
}

/* ---------- Asset lifecycle with an RMA loop ---------- */
const LIFE: PetriSpec = {
  title: "Asset lifecycle Petri net with an RMA loop",
  desc: "A spare moves from in stock to staged, installed and in service. When a part fails, Swap restores service using a spare, and the failed part goes out on RMA to the vendor and returns to stock. Before the fix, Swap waits for a spare from the central store. The fix pre-stages spares beside the racks.",
  vw: 140,
  nodes: {
    stock: { type: "p", label: "in stock" }, stage: { type: "t", label: "Stage" }, staged: { type: "p", label: "staged" },
    install: { type: "t", label: "Install" }, svc: { type: "p", label: "in service" }, fail: { type: "t", label: "Fail" },
    failed: { type: "p", label: "failed" }, swap: { type: "t", label: "Swap", sub: "needs a spare" },
    rship: { type: "t", label: "RMA ship" }, vendor: { type: "p", label: "with vendor" }, rret: { type: "t", label: "RMA return" },
  },
  layouts: {
    h: { w: 900, h: 330, nodes: { stock: [40, 70], stage: [150, 70], staged: [260, 70], install: [370, 70], svc: [480, 70], fail: [590, 70], failed: [700, 70], swap: [590, 180], rship: [810, 170], vendor: [810, 280], rret: [480, 280] } },
    v: { w: 360, h: 700, nodes: { stock: [90, 30], stage: [90, 100], staged: [90, 170], install: [90, 240], svc: [90, 310], fail: [90, 380], failed: [90, 450], swap: [270, 380], rship: [90, 530], vendor: [90, 610], rret: [270, 610] } },
  },
  arcs: [
    ["stock", "stage"], ["stage", "staged"], ["staged", "install"], ["install", "svc"], ["svc", "fail"], ["fail", "failed"],
    ["failed", "swap"], ["swap", "svc", "", { h: 30, v: 0 }],
    ["failed", "rship", "rework"], ["rship", "vendor", "rework"], ["vendor", "rret", "rework"], ["rret", "stock", "rework", { h: -60, v: 60 }],
    ["staged", "swap", "fix", { h: 40, v: -40 }],
  ],
  hidden: ["staged>swap"],
};
const CASE = ["svc", "fail", "failed", "swap", "svc"], PART = ["failed", "rship", "vendor", "rret", "stock", "stage", "staged"];
const L_BEFORE: SimConfig = { spawnEvery: .8, speed: 150, lateAt: "failed", dwell: { failed: 3.4, vendor: 1.2, svc: .3, staged: .3, stock: .3 }, route: () => (Math.random() < .55 ? CASE : PART) };
const L_AFTER: SimConfig = { spawnEvery: .8, speed: 150, lateAt: "failed", dwell: { failed: .5, vendor: 1.2, svc: .3, staged: .3, stock: .3 }, route: () => (Math.random() < .55 ? CASE : PART) };

function Lifecycle() {
  const [fixed, setFixed] = useState(false);
  const [wait, setWait] = useState(26);
  const fx = useMemo(() => (fixed ? { ids: ["swap"], reveal: ["staged>swap"] } : null), [fixed]);
  return (
    <div className="split">
      <div>
        <div className="diagram-box no-swipe"><PetriNet spec={LIFE} config={fixed ? L_AFTER : L_BEFORE} hot={["swap"]} fixed={fx} /></div>
        <div className="legend" aria-hidden="true"><span><i style={{ border: "2px solid var(--bad)" }} />waits for a spare</span><span><i style={{ border: "2px dashed var(--bad)" }} />RMA loop</span><span><i style={{ border: "2px solid var(--act)" }} />pre-staged spare</span></div>
      </div>
      <div className="card" aria-live="polite">
        <h3>{fixed ? "After: pre-staged" : "Before: central store"} <Syn /></h3>
        <div className="kpi">
          <div className="k">Failed part → back in service <b className={fixed ? "good" : "bad"}>{wait.toFixed(1)} h</b></div>
        </div>
        <p className="small muted">Before the fix, Swap waits for a spare from the central store. Pre-staging puts the most-failed part classes beside the racks, sized by the reorder point.</p>
        <div className="row">
          <button className="btn btn-primary" disabled={fixed} onClick={() => { setFixed(true); tween(26, 4.5, 1200, setWait); }}>Pre-stage spares</button>
          <button className="btn btn-ghost" onClick={() => { setFixed(false); setWait(26); }}>Reset</button>
        </div>
        <p className="small muted mt">Illustrative synthetic figures, not Meta data.</p>
      </div>
    </div>
  );
}

/* ---------- FIFO lot picking ---------- */
const LOTS = [
  { lot: "L-2407-118", received: "2026-07-18", qty: 24 }, { lot: "L-2408-031", received: "2026-08-03", qty: 40 },
  { lot: "L-2409-207", received: "2026-09-20", qty: 40 }, { lot: "L-2410-115", received: "2026-10-11", qty: 60 },
];
const SQL = `-- FIFO pick: oldest lots first, until the order is filled
WITH ranked AS (
  SELECT lot_id, received_at, qty_on_hand,
         SUM(qty_on_hand) OVER (ORDER BY received_at, lot_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
  FROM   lot_stock
  WHERE  part_no = :part AND site = :site AND status = 'available'
)
SELECT lot_id, received_at,
       LEAST(qty_on_hand, :order_qty - (running - qty_on_hand)) AS pick_qty
FROM   ranked
WHERE  running - qty_on_hand < :order_qty   -- lots needed to cover the order
ORDER  BY received_at, lot_id;`;
function Fifo() {
  const [q, setQ] = useState(50);
  let left = q;
  const picks = LOTS.map((l) => { const p = Math.max(0, Math.min(l.qty, left)); left -= p; return p; });
  return (
    <div className="split even">
      <pre tabIndex={0} aria-label="FIFO lot picking SQL">{SQL}</pre>
      <div className="card">
        <label className="f">Order quantity (SSD 3.84 TB, DC-C)
          <input type="number" min={1} max={164} value={q} onChange={(e) => setQ(Math.max(1, Math.min(164, +e.target.value || 1)))} />
        </label>
        <div className="table-wrap mt"><table>
          <thead><tr><th>Lot</th><th>Received</th><th className="num">On hand</th><th className="num">Pick</th></tr></thead>
          <tbody>{LOTS.map((l, k) => (
            <tr key={l.lot} style={picks[k] ? { background: "var(--act-tint)" } : undefined}><td>{l.lot}</td><td>{l.received}</td><td className="num">{l.qty}</td><td className="num"><b>{picks[k] || "–"}</b></td></tr>
          ))}</tbody>
        </table></div>
        <p className="small muted mt">The same logic as the SQL, run in your browser. Every pick records its lot, so a recall can find each unit. <Syn /></p>
      </div>
    </div>
  );
}

/* ---------- A Tuesday at DC-C ---------- */
const DAY: [string, string, "" | "alert" | "fix"][] = [
  ["07:40", "Overnight: 11 SSD failures logged at DC-C, about twice the usual rate.", "alert"],
  ["08:05", "The miner flags it: 9 of the 11 swaps are waiting on Swap for a spare from the central store.", "alert"],
  ["08:20", "Reorder point check: SSD 3.84 TB at DC-C is below ROP once the lead time slips to 1.5×.", "alert"],
  ["09:00", "Session with the site lead and the inventory planner: confirm it's a bad lot, not a trend.", ""],
  ["09:35", "FIFO query traces 8 failures to lot L-2407-118. The lot goes on hold and its RMA batch is raised.", "fix"],
  ["10:10", "Claude Code drafts a rule: pre-stage 6 SSDs per hall at DC-C. A person reviews and approves it.", "fix"],
  ["13:30", "Swaps resume from the pre-staged spares, and the queue at Swap clears.", "fix"],
  ["16:45", "Re-mined: no request waiting more than 4 h. The note is saved as a rule for the next cycle.", "fix"],
];
function Tuesday() {
  const [n, setN] = useState(0);
  const [play, setPlay] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!play) return;
    t.current = window.setInterval(() => setN((k) => { if (k >= DAY.length) { setPlay(false); return k; } return k + 1; }), matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 1300);
    return () => clearInterval(t.current);
  }, [play]);
  return (
    <div className="split">
      <ol className="timeline" aria-live="polite">
        {DAY.map(([time, text, k], j) => <li key={time} className={(j < n ? "on " : "") + k}><span className="t">{time}</span><span>{text}</span></li>)}
      </ol>
      <div className="card" style={{ alignSelf: "start" }}>
        <h3>Play the day <Syn /></h3>
        <p className="small muted">A made-up scenario that shows how the pieces on this page fit together: reorder points, the lifecycle net, FIFO and a person approving the change.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => { if (n >= DAY.length) setN(0); setPlay(!play); }}>{play ? "Pause" : n >= DAY.length ? "Replay" : n ? "Resume" : "Start the clock"}</button>
          <button className="btn btn-ghost" onClick={() => setN((k) => Math.min(DAY.length, k + 1))}>Step</button>
        </div>
        <p className="small muted mt">{n}/{DAY.length} events</p>
      </div>
    </div>
  );
}

const slides: Slide[] = [
  {
    id: "top", label: "Spares",
    body: (
      <section className="hero on-dark" aria-labelledby="sp">
        <div className="wrap">
          <R i={0}><span className="eyebrow">Meta use cases · synthetic sample</span></R>
          <R i={1}><h1 id="sp" style={{ fontSize: "clamp(2.2rem,6vw,3.8rem)" }}>Spares, at data centre scale.</h1></R>
          <R i={2}><p className="lede">Data centre logistics is new to me, and I'm keen to learn it. These four sketches show how I'd start: reorder points, an asset lifecycle with RMA, FIFO lots, and a day when they all meet.</p></R>
          <R i={3}><p><span className="tag-syn" style={{ color: "#DDE3E8", borderColor: "#8595A4" }}>Synthetic sample</span> &nbsp;Every part, site, demand, lead time and lot on this page is made up.</p></R>
          <R i={4} className="row mt"><a className="btn btn-primary" href="#rop">Reorder points →</a><a className="btn btn-ghost" href="#tuesday">A Tuesday at DC-C</a></R>
        </div>
      </section>
    ),
  },
  { id: "rop", label: "Reorder points", body: <Sec eyebrow="Per part and data centre" title="When to reorder each spare." id="r"><Rop /></Sec> },
  { id: "lifecycle", label: "Asset lifecycle", body: <Sec tone="alt" eyebrow="Asset lifecycle · RMA loop" title="Where a failed part waits." id="l"><Lifecycle /></Sec> },
  { id: "fifo", label: "FIFO lots", body: <Sec eyebrow="Lot tracking and FIFO" title="Oldest lot first, every lot recorded." id="f"><Fifo /></Sec> },
  { id: "tuesday", label: "Tuesday at DC-C", body: <Sec tone="alt" eyebrow="A timed scenario" title="A Tuesday at DC-C." id="t"><Tuesday /></Sec> },
];

export function Spares() { return <Deck slides={slides} />; }
