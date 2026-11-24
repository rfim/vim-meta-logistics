// Spares Control Tower: the data model and a seeded, SYNTHETIC starting state.
// Every action in the tower appends an event, so the tool can mine its own event log.

export type Site = "DC-A" | "DC-B" | "DC-C";
export const SITES: Site[] = ["DC-A", "DC-B", "DC-C"];
export type Status = "awaiting approval" | "approved" | "picked" | "shipped" | "received" | "installed" | "rma" | "rejected";
export const FLOW: Status[] = ["awaiting approval", "approved", "picked", "shipped", "received", "installed"];

export type Part = { id: string; name: string; limit: number; mu: Record<Site, number>; sigma: Record<Site, number>; lead: number };
export type Lot = { id: string; part: string; site: Site; received: number; qty: number; status: "available" | "recalled" };
export type Req = { id: string; ticket: string; part: string; site: Site; qty: number; likeForLike: boolean; requester: string; created: number; status: Status; lot?: string; note?: string };
export type Ev = { id: number; case: string; act: string; t: number; who: string; site: Site; detail: string };
export type Rule = { text: string; source: string; part?: string; site?: Site };

export const PARTS: Part[] = [
  { id: "SSD", name: "SSD 3.84 TB", limit: 4, lead: 9, mu: { "DC-A": 6.2, "DC-B": 4.8, "DC-C": 8.9 }, sigma: { "DC-A": 2.1, "DC-B": 1.7, "DC-C": 3.6 } },
  { id: "DIMM", name: "DIMM 64 GB", limit: 8, lead: 7, mu: { "DC-A": 9.5, "DC-B": 7.0, "DC-C": 11.2 }, sigma: { "DC-A": 3.4, "DC-B": 2.9, "DC-C": 4.1 } },
  { id: "PSU", name: "PSU 2 kW", limit: 2, lead: 14, mu: { "DC-A": 1.4, "DC-B": 1.1, "DC-C": 1.9 }, sigma: { "DC-A": 0.8, "DC-B": 0.7, "DC-C": 1.1 } },
  { id: "NIC", name: "NIC 100G", limit: 2, lead: 21, mu: { "DC-A": 0.9, "DC-B": 0.7, "DC-C": 1.2 }, sigma: { "DC-A": 0.6, "DC-B": 0.5, "DC-C": 0.8 } },
  { id: "FAN", name: "Fan module", limit: 6, lead: 5, mu: { "DC-A": 3.1, "DC-B": 2.6, "DC-C": 3.8 }, sigma: { "DC-A": 1.2, "DC-B": 1.0, "DC-C": 1.5 } },
];
export const partOf = (id: string) => PARTS.find((p) => p.id === id)!;
/** ROP = μL + zσ√L at a 95% service level (z = 1.645) */
export const rop = (p: Part, s: Site) => Math.ceil(p.mu[s] * p.lead + 1.645 * p.sigma[s] * Math.sqrt(p.lead));

export type Tower = { now: number; reqs: Req[]; lots: Lot[]; log: Ev[]; rules: Rule[]; examples: string[]; nextEv: number };

export const stockOf = (t: Tower, part: string, site: Site) => t.lots.filter((l) => l.part === part && l.site === site && l.status === "available").reduce((s, l) => s + l.qty, 0);
/** FIFO: oldest available lots first */
export const fifoLots = (t: Tower, part: string, site: Site) => t.lots.filter((l) => l.part === part && l.site === site && l.status === "available" && l.qty > 0).sort((a, b) => a.received - b.received);

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A seeded starting state: two weeks of history (so there is something to mine) plus today's open work. */
export function seed(): Tower {
  const r = rng(11), now = 336; // hours since the start of the history window
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const lots: Lot[] = [];
  let lotN = 700;
  for (const p of PARTS) for (const s of SITES) {
    const base = rop(p, s), n = 3;
    // a few part/site pairs run low, as they do in real life
    const low = (p.id === "SSD" && s === "DC-C") || (p.id === "PSU" && s === "DC-A") || (p.id === "NIC" && s === "DC-B");
    for (let k = 0; k < n; k++) lots.push({ id: `L-${lotN++}`, part: p.id, site: s, received: 40 + k * 90 + Math.floor(r() * 30), qty: Math.max(1, Math.round(base * (low ? 0.18 + r() * 0.06 : 0.36 + r() * 0.14))), status: "available" });
  }
  const log: Ev[] = [], reqs: Req[] = [];
  let id = 1;
  const ev = (c: string, act: string, t: number, who: string, site: Site, detail = "") => log.push({ id: id++, case: c, act, t: +t.toFixed(2), who, site, detail });
  const techs = ["tech:ana", "tech:ben", "tech:kofi"], leads: Record<Site, string> = { "DC-A": "lead:cy", "DC-B": "lead:dee", "DC-C": "lead:eli" };
  // history: closed work orders, with the slow approvals the miner will find (DC-C is slowest)
  for (let i = 0; i < 70; i++) {
    const s = pick(SITES), p = pick(PARTS), c = `WO-${String(1000 + i)}`, t0 = 4 * i + r() * 3;
    const tech = pick(techs);
    ev(c, "requested", t0, tech, s, `${p.name} × 1`);
    const slow = r() < (s === "DC-C" ? 0.5 : 0.28);
    const tA = t0 + (slow ? 24 + r() * 30 : 1 + r() * 5);
    ev(c, "approved", tA, leads[s], s);
    const tP = tA + 1 + r() * 3; ev(c, "picked", tP, "wms", s, "FIFO");
    const tS = tP + 1 + r() * 2; ev(c, "shipped", tS, "wms", s);
    const tR = tS + 6 + r() * 10; ev(c, "received", tR, "dock", s);
    if (r() < 0.12) { ev(c, "rma opened", tR + 1, tech, s, "mismatch at install"); ev(c, "picked", tR + 3 + r() * 4, "wms", s, "re-pick"); }
    ev(c, "installed", tR + 2 + r() * 6, tech, s);
  }
  // today: open work orders in every state
  const states: Status[] = ["awaiting approval", "awaiting approval", "awaiting approval", "awaiting approval", "awaiting approval", "awaiting approval", "awaiting approval", "approved", "approved", "picked", "shipped", "received"];
  states.forEach((st, k) => {
    const s = SITES[k % 3], p = PARTS[(k * 2 + 1) % PARTS.length], c = `WO-${2000 + k}`;
    const age = st === "awaiting approval" ? [31, 4, 26, 2, 44, 7, 1.5][k] ?? 3 : 6 + k;
    const qty = k === 4 ? p.limit + 2 : 1 + (k % 2);
    const req: Req = { id: c, ticket: `T-${88100 + k}`, part: p.id, site: s, qty, likeForLike: k !== 6, requester: pick(techs), created: now - age, status: st };
    reqs.push(req);
    ev(c, "requested", req.created, req.requester, s, `${p.name} × ${qty}`);
    const order: Status[] = ["approved", "picked", "shipped", "received"];
    let t = req.created;
    for (const o of order) { if (FLOW.indexOf(o) > FLOW.indexOf(st)) break; t += o === "approved" ? 2 + (k % 3) : 1.5; ev(c, o, Math.min(t, now - 0.2), o === "approved" ? leads[s] : "wms", s); }
  });
  return {
    now, reqs, lots, log, nextEv: id,
    rules: [{ text: "Never approve automatically for a part class outside the allow-list.", source: "seed" }, { text: "Every automated decision writes an audit event: who, rule, limit.", source: "seed" }],
    examples: [],
  };
}

/* ---------------- mining the tower's own log ---------------- */
const q = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
/** Approval waits, split at the moment auto-approve was switched on (null = never) */
export function approvalSplit(log: Ev[], since: number | null) {
  const req = new Map<string, number>(), out = { before: [] as number[], after: [] as number[] };
  for (const e of [...log].sort((a, b) => a.t - b.t)) {
    if (e.act === "requested") req.set(e.case, e.t);
    if (e.act === "approved" && req.has(e.case)) { const r = req.get(e.case)!; (since !== null && r >= since ? out.after : out.before).push(e.t - r); }
  }
  return { before: { p75: q(out.before, 0.75), n: out.before.length }, after: { p75: q(out.after, 0.75), n: out.after.length } };
}

export function mineTower(log: Ev[]) {
  const by = new Map<string, Ev[]>();
  for (const e of log) { if (!by.has(e.case)) by.set(e.case, []); by.get(e.case)!.push(e); }
  const waits = new Map<string, number[]>(), site = new Map<string, number[]>(), edges = new Map<string, number>(), variants = new Map<string, number>();
  for (const evs of by.values()) {
    evs.sort((a, b) => a.t - b.t);
    variants.set(evs.map((e) => e.act).join(" → "), (variants.get(evs.map((e) => e.act).join(" → ")) || 0) + 1);
    for (let k = 1; k < evs.length; k++) {
      const a = evs[k - 1], b = evs[k], h = b.t - a.t;
      if (!waits.has(b.act)) waits.set(b.act, []); waits.get(b.act)!.push(h);
      edges.set(a.act + " → " + b.act, (edges.get(a.act + " → " + b.act) || 0) + 1);
      if (b.act === "approved") { if (!site.has(b.site)) site.set(b.site, []); site.get(b.site)!.push(h); }
    }
  }
  const w = [...waits].map(([a, xs]) => ({ a, med: q(xs, 0.5), p75: q(xs, 0.75), n: xs.length })).filter((x) => x.a !== "received").sort((x, y) => y.p75 - x.p75);
  return {
    cases: by.size, events: log.length,
    waits: w, bottleneck: w[0],
    bySite: SITES.map((s) => ({ site: s, p75: q(site.get(s) || [], 0.75), n: (site.get(s) || []).length })),
    edges: [...edges].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n),
    variants: [...variants].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n),
  };
}
