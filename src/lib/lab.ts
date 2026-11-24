// Process Lab engine: ERP-shaped data → event log → discovered Petri net → the wait → a prompt for the
// agent harness → a fix → re-mined. Everything runs in the browser on SYNTHETIC, seeded data.
// Table and field names follow the real systems (SAP, Oracle EBS, Odoo) so the mapping is recognisable.
import type { PetriSpec, SimConfig } from "./petri";

export type Ev = { c: string; a: string; t: number; site: string; who: string }; // t in hours
export type Raw = { name: string; note: string; cols: string[]; rows: (string | number)[][] };
type Step = { a: string; wait: [number, number]; slow?: { p: number; wait: [number, number] }; who: string[] };
type Flow = { steps: Step[]; rework?: { after: string; via: string; back: string; p: number; wait: [number, number] }; skip?: { a: string; p: number }; sites: string[] };

export type SourceId = "metadc" | "dcpipe" | "sap" | "oracle" | "odoo";
export type Source = {
  id: SourceId; label: string; system: string; flow: string; synthetic: string;
  transit: string[]; queueAct: string; fixTitle: string; fixWhat: string;
  def: Flow; tables: (evs: Ev[]) => Raw[]; mapping: string; mappingLang: "sql" | "py";
  fixedWait?: [number, number];         // how long the queue step takes once fixed (default 0.5–2 h)
  fixShare?: number;                    // share of cases the fix reaches (default 0.6: only some orders qualify)
  slowAfter?: number;                   // hours after which a wait counts as slow (default 24)
  rules?: string[];                     // rules from past reviews (default: approval-flow rules)
  tests?: (m: Mined) => string[];       // acceptance tests (default: approval-flow tests)
  stopRule?: string; outOfScope?: string; measured?: string; searchWord?: string;
};

/* ---------------- seeded randomness ---------------- */
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const between = (r: () => number, [a, b]: [number, number]) => a + r() * (b - a);

/** Generate a log from a flow definition. `fixed` applies the approved fix to the queue step and the rework. */
export function generate(src: Source, n = 400, fixed = false, seed = 7): Ev[] {
  const r = rng(seed + (fixed ? 1000 : 0)), f = src.def, out: Ev[] = [];
  for (let i = 1; i <= n; i++) {
    const c = `${src.id.toUpperCase()}-${String(i).padStart(4, "0")}`, site = pick(r, f.sites);
    let t = i * 0.9;
    const push = (a: string, w: number, who: string[]) => { t += w; out.push({ c, a, t: +t.toFixed(2), site, who: pick(r, who) }); };
    for (const s of f.steps) {
      if (f.skip && s.a === f.skip.a && r() < f.skip.p * (fixed ? 0.15 : 1)) continue; // breach: step skipped
      let w = s.slow && r() < s.slow.p ? between(r, s.slow.wait) : between(r, s.wait);
      if (fixed && s.a === src.queueAct && r() < (src.fixShare ?? 0.6)) w = between(r, src.fixedWait || [0.5, 2]); // handled by the fix
      push(s.a, w, s.who);
      if (f.rework && s.a === f.rework.after && r() < f.rework.p * (fixed ? 0.5 : 1)) {
        push(f.rework.via, between(r, f.rework.wait), s.who);
        const back = f.steps.find((x) => x.a === f.rework!.back)!;
        push(back.a, fixed && back.a === src.queueAct ? 1 : between(r, back.slow ? back.slow.wait : back.wait), back.who);
      }
    }
  }
  return out;
}

/* ---------------- mining ---------------- */
export const traces = (log: Ev[]) => { const m = new Map<string, Ev[]>(); for (const e of log) { if (!m.has(e.c)) m.set(e.c, []); m.get(e.c)!.push(e); } for (const v of m.values()) v.sort((a, b) => a.t - b.t); return m; };
const q = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };

export type Mined = {
  cases: number; events: number; order: string[];
  edges: { a: string; b: string; n: number }[]; variants: { v: string[]; n: number }[];
  waits: { a: string; med: number; p75: number; n: number }[];
  bottleneck: { a: string; med: number; p75: number; over24: number };
  bySite: { site: string; med: number }[];
  rework: number; breach: number; fit: { m: number; c: number; r: number; p: number; f: number };
};

export function mine(src: Source, log: Ev[]): Mined {
  const ts = traces(log), cases = ts.size;
  const edgeN = new Map<string, number>(), varN = new Map<string, number>(), pos = new Map<string, number[]>(), w = new Map<string, number[]>();
  const site = new Map<string, number[]>();
  for (const evs of ts.values()) {
    varN.set(evs.map((e) => e.a).join("›"), (varN.get(evs.map((e) => e.a).join("›")) || 0) + 1);
    evs.forEach((e, k) => { if (!pos.has(e.a)) pos.set(e.a, []); pos.get(e.a)!.push(k); });
    for (let k = 1; k < evs.length; k++) {
      const a = evs[k - 1], b = evs[k], key = a.a + "›" + b.a, h = b.t - a.t;
      edgeN.set(key, (edgeN.get(key) || 0) + 1);
      if (!w.has(b.a)) w.set(b.a, []); w.get(b.a)!.push(h);
      if (b.a === src.queueAct) { if (!site.has(b.site)) site.set(b.site, []); site.get(b.site)!.push(h); }
    }
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const order = [...pos.keys()].sort((a, b) => avg(pos.get(a)!) - avg(pos.get(b)!));
  const edges = [...edgeN].map(([k, n]) => { const [a, b] = k.split("›"); return { a, b, n }; }).sort((x, y) => y.n - x.n);
  const variants = [...varN].map(([k, n]) => ({ v: k.split("›"), n })).sort((x, y) => y.n - x.n);
  const waits = [...w].map(([a, xs]) => ({ a, med: q(xs, 0.5), p75: q(xs, 0.75), n: xs.length })).sort((x, y) => y.med - x.med);
  const queue = waits.filter((x) => !src.transit.includes(x.a) && x.a === src.queueAct)[0] || waits.filter((x) => !src.transit.includes(x.a))[0];
  const qs = w.get(queue.a) || [];
  const main = src.def.steps.map((s) => s.a);
  const rework = variants.filter((v) => src.def.rework && v.v.includes(src.def.rework.via)).reduce((s, v) => s + v.n, 0) / cases;
  const breach = variants.filter((v) => src.def.skip && !v.v.includes(src.def.skip.a)).reduce((s, v) => s + v.n, 0) / cases;
  return {
    cases, events: log.length, order, edges, variants, waits,
    bottleneck: { a: queue.a, med: queue.med, p75: queue.p75, over24: qs.filter((h) => h > (src.slowAfter ?? 24)).length / (qs.length || 1) },
    bySite: [...site].map(([s, xs]) => ({ site: s, med: q(xs, 0.5) })).sort((a, b) => a.site.localeCompare(b.site)),
    rework, breach, fit: replay(ts, main),
  };
}

/** Token replay on the sequential target model (the designed process): fitness = ½(1 − m/c) + ½(1 − r/p) */
export function replay(ts: Map<string, Ev[]>, model: string[]) {
  let m = 0, c = 0, r = 0, p = 0;
  const pre = new Map(model.map((a, i) => [a, i === 0 ? "start" : "p" + (i - 1)])), post = new Map(model.map((a, i) => [a, "p" + i]));
  const end = "p" + (model.length - 1);
  for (const evs of ts.values()) {
    const mk = new Map<string, number>([["start", 1]]); p++;
    for (const e of evs) {
      if (!pre.has(e.a)) continue;
      const i = pre.get(e.a)!, o = post.get(e.a)!;
      if (!mk.get(i)) { m++; mk.set(i, 1); }
      mk.set(i, mk.get(i)! - 1); c++; mk.set(o, (mk.get(o) || 0) + 1); p++;
    }
    if (!mk.get(end)) { m++; mk.set(end, 1); }
    mk.set(end, mk.get(end)! - 1); c++;
    for (const v of mk.values()) r += v;
  }
  return { m, c, r, p, f: 0.5 * (1 - m / c) + 0.5 * (1 - r / p) };
}

/* ---------------- discovered Petri net ---------------- */
const id = (a: string) => "t_" + a.replace(/[^a-z0-9]/gi, "_");
const pid = (a: string) => "p_" + a.replace(/[^a-z0-9]/gi, "_");

export function discoverNet(src: Source, m: Mined): { spec: PetriSpec; config: (fixedMined?: Mined) => SimConfig; hot: string[] } {
  // Backbone = the most common variant. Everything else (rework, exceptions) sits on a row below it.
  const backbone = [...new Set(m.variants[0].v)], bi = new Map(backbone.map((a, i) => [a, i]));
  const extras = m.order.filter((a) => !bi.has(a));
  const min = Math.max(2, Math.round(m.cases * 0.02));
  const edges = m.edges.filter((e) => e.n >= min);
  const nodes: PetriSpec["nodes"] = { s: { type: "p", label: "start" } };
  const H: Record<string, [number, number]> = { s: [30, 100] }, V: Record<string, [number, number]> = { s: [100, 30] };
  const n = backbone.length;
  backbone.forEach((a, i) => {
    nodes[id(a)] = { type: "t", label: a.length > 15 ? a.slice(0, 14) + "…" : a };
    nodes[pid(a)] = { type: "p", label: i === n - 1 ? "done" : "" };
    H[id(a)] = [125 + i * 190, 100]; H[pid(a)] = [220 + i * 190, 100];
    V[id(a)] = [100, 100 + i * 140]; V[pid(a)] = [100, 170 + i * 140];
  });
  extras.forEach((e) => {
    const into = edges.filter((x) => x.b === e && bi.has(x.a)).sort((x, y) => y.n - x.n)[0];
    const i = into ? bi.get(into.a)! : 0;
    nodes[id(e)] = { type: "t", label: e, sub: "exception" };
    nodes[pid(e)] = { type: "p", label: "" };
    H[id(e)] = [220 + i * 190, 205]; H[pid(e)] = [220 + i * 190 + 110, 205];
    V[id(e)] = [275, 170 + i * 140]; V[pid(e)] = [275, 170 + i * 140 + 62];
  });
  const arcs: PetriSpec["arcs"] = [["s", id(backbone[0])]];
  new Set(m.variants.map((v) => v.v[0])).forEach((a) => { if (a !== backbone[0] && nodes[id(a)]) arcs.push(["s", id(a), "rework", { h: -40, v: 40 }]); });
  [...backbone, ...extras].forEach((a) => arcs.push([id(a), pid(a)]));
  for (const e of edges) {
    if (!nodes[id(e.a)] || !nodes[id(e.b)]) continue;
    const both = bi.has(e.a) && bi.has(e.b), d = both ? bi.get(e.b)! - bi.get(e.a)! : 0;
    if (both && d === 1) arcs.push([pid(e.a), id(e.b)]);
    else if (both) arcs.push([pid(e.a), id(e.b), "rework", d > 0 ? { h: -(50 + 12 * d), v: 50 + 12 * d } : { h: 50 + 12 * -d, v: -(50 + 12 * -d) }]);
    else arcs.push([pid(e.a), id(e.b), "rework"]);
  }
  const have = new Set(arcs.map(([a, b]) => a + ">" + b));
  const spec: PetriSpec = {
    title: `Petri net discovered from the ${src.system} event log`,
    desc: `Main path: ${backbone.join(", ")}.${extras.length ? ` Exceptions below the main path: ${extras.join(", ")}.` : ""} Red dashed arcs are rework or skipped steps. The bottleneck transition is outlined in red.`,
    vw: 150, nodes,
    layouts: { h: { w: 60 + n * 190 + 30, h: extras.length ? 260 : 170, nodes: H }, v: { w: 360, h: 100 + n * 140 + 20, nodes: V } },
    arcs,
  };
  const config = (fx?: Mined): SimConfig => {
    const mm = fx || m;
    const wmed = new Map(mm.waits.map((x) => [x.a, x.med])), maxw = Math.max(...mm.waits.filter((x) => !src.transit.includes(x.a)).map((x) => x.med), 1);
    const dwell: Record<string, number> = {};
    // a place holds the token for the wait before the next step (scaled to seconds)
    backbone.forEach((a, i) => { const next = backbone[i + 1]; const h = next ? wmed.get(next) || 0 : 0; dwell[pid(a)] = next && src.transit.includes(next) ? 0.35 : 0.2 + 3 * Math.min(1, h / maxw); });
    extras.forEach((e) => { dwell[pid(e)] = 0.6; });
    const routes = mm.variants.map((v) => {
      const r = ["s"]; v.v.forEach((a, k) => { if (k > 0) r.push(pid(v.v[k - 1])); r.push(id(a)); }); r.push(pid(v.v[v.v.length - 1]));
      const ok = r.every((x, k) => k === 0 || have.has(r[k - 1] + ">" + x));
      return { r, n: v.n, ok };
    }).filter((x) => x.ok);
    const tot = routes.reduce((s, x) => s + x.n, 0);
    return {
      spawnEvery: 0.5, speed: 220, lateAt: pid(backbone[Math.max(0, backbone.indexOf(m.bottleneck.a) - 1)]), dwell,
      route: () => { let x = Math.random() * tot; for (const rt of routes) { x -= rt.n; if (x <= 0) return rt.r; } return routes[0].r; },
    };
  };
  return { spec, config, hot: [id(m.bottleneck.a)] };
}

/* ---------------- prompts for the agent harness ---------------- */
export type Harness = "claude" | "codex" | "inhouse";
export const HARNESS: Record<Harness, { label: string; memory: string; note: string }> = {
  claude: { label: "Claude Code", memory: "CLAUDE.md", note: "Claude Code reads CLAUDE.md at the start of every session; the task goes in the chat." },
  codex: { label: "Codex", memory: "AGENTS.md", note: "Codex reads AGENTS.md for repository rules; the task goes in the prompt." },
  inhouse: { label: "In-house agent", memory: "system prompt", note: "For an internal agent platform: the same content as a system prompt plus a structured task spec." },
};

export function prompts(src: Source, m: Mined, harness: Harness) {
  const b = m.bottleneck, h = (x: number) => x.toFixed(1);
  const facts = [
    `Source: ${src.system}, ${src.flow} (synthetic sample, ${m.cases} cases, ${m.events} events)`,
    `Discovered main path: ${m.variants[0].v.join(" → ")} (${Math.round((m.variants[0].n / m.cases) * 100)}% of cases)`,
    m.order.some((a) => !m.variants[0].v.includes(a)) ? `Exceptions seen: ${m.order.filter((a) => !m.variants[0].v.includes(a)).join(", ")}` : "",
    `Bottleneck: wait before "${b.a}", median ${h(b.med)} h, p75 ${h(b.p75)} h, ${(b.over24 * 100).toFixed(0)}% of cases wait > ${src.slowAfter ?? 24} h`,
    `Per site: ${m.bySite.map((s) => `${s.site} ${h(s.med)} h`).join(", ")}`,
    src.def.rework ? `Rework: ${(m.rework * 100).toFixed(0)}% of cases loop through "${src.def.rework.via}"` : "",
    src.def.skip ? `Rule breaches: ${(m.breach * 100).toFixed(0)}% of cases skip "${src.def.skip.a}"` : "",
    `Process fitness: ${m.fit.f.toFixed(2)} (m=${m.fit.m} c=${m.fit.c} r=${m.fit.r} p=${m.fit.p})`,
  ].filter(Boolean);
  const rules = src.rules || [
    `Never auto-handle "${b.a}" outside limits agreed with the business; read limits from ${src.system} configuration, never hard-code them.`,
    "Every automated decision writes an audit event (who, rule id, limit), retries included.",
    "Check per-site impact before claiming an average improvement.",
    "Ship behind a feature flag per site; rollback = flag off.",
    "Use synthetic fixtures in tests; never copy production names or values.",
  ];
  const tests = src.tests ? src.tests(m) : [
    `Replay the ${m.variants[0].n} cases on the happy path: all still pass.`,
    `p75 wait before "${b.a}" ≤ 8 h at every site after the change.`,
    src.def.skip ? `Every case has a "${src.def.skip.a}" event (no breaches).` : "No case loses an audit event.",
    "Re-mined fitness ≥ 0.80.",
  ];
  const before = `${src.fixTitle.toLowerCase()}`;
  const ctx = `## Mined context\n${facts.map((x) => "- " + x).join("\n")}`;
  const task = `## Task\n${src.fixWhat}\n\n## Acceptance tests (generated from the mined variants)\n${tests.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n## Out of scope\n${src.outOfScope || `Pricing, supplier selection, and anything outside the ${src.flow} flow.`}`;
  const rulesMd = rules.map((x) => "- " + x).join("\n");
  if (harness === "claude") return {
    before,
    files: [
      { name: "CLAUDE.md", body: `# ${src.flow}: project memory\n\n## How to work here\n- Start in plan mode: read the code paths for "${b.a}", then propose a plan and wait for approval.\n- Run the acceptance tests with \`pytest tests/test_${src.id}_flow.py\` before saying you are done.\n- ${src.stopRule || "Stop and ask if a change would touch approval limits."}\n\n## Rules from past reviews\n${rulesMd}` },
      { name: "Task (in the chat)", body: `${ctx}\n\n${task}\n\nPlan first. Do not edit files until the plan is approved.` },
    ],
  };
  if (harness === "codex") return {
    before,
    files: [
      { name: "AGENTS.md", body: `# Agent instructions: ${src.flow}\n\n## Commands\n- Tests: \`pytest tests/test_${src.id}_flow.py\`\n- Lint: \`ruff check .\`\n\n## Rules from past reviews\n${rulesMd}\n\n## Definition of done\nAll acceptance tests in the task pass, and the PR description lists per-site impact.` },
      { name: "Task (prompt)", body: `${ctx}\n\n${task}\n\nOpen one PR. Include the re-mined numbers in the description.` },
    ],
  };
  return {
    before,
    files: [
      { name: "System prompt", body: `You are a change agent for the ${src.flow} process in ${src.system}.\nYou propose code and configuration changes; a person approves every change before it ships.\n\nRules from past reviews:\n${rulesMd}` },
      { name: "Task spec (YAML)", body: `task: ${src.fixTitle}\nsource: ${src.system}\nmined:\n${facts.map((x) => "  - " + JSON.stringify(x)).join("\n")}\nchange: ${JSON.stringify(src.fixWhat)}\nacceptance:\n${tests.map((x) => "  - " + JSON.stringify(x)).join("\n")}\napproval: required_before_merge\nrollback: feature_flag_per_site` },
    ],
  };
}

/* ---------------- the four sources ---------------- */
const fmt = (h: number) => { const d = new Date(Date.UTC(2026, 9, 1) + h * 3600e3); return d.toISOString().slice(0, 16).replace("T", " "); };
const first = (evs: Ev[], a: string, n = 6) => evs.filter((e) => e.a === a).slice(0, n);

export const SOURCES: Record<SourceId, Source> = {
  metadc: {
    id: "metadc", label: "Meta data centre", system: "data-centre tooling", flow: "spares request", synthetic: "Synthetic sample: a possible data-centre spares flow, not Meta data.",
    transit: ["ship", "receive"], queueAct: "approve",
    fixTitle: "Speed up spares approvals",
    fixWhat: "Auto-approve like-for-like spares within limits agreed with the business, and add scan-to-confirm at pick so mismatches are caught before they ship.",
    def: {
      sites: ["DC-A", "DC-B", "DC-C"],
      steps: [
        { a: "part failure", wait: [0, 0], who: ["monitor"] },
        { a: "spares request", wait: [0.2, 1.5], who: ["tech:ana", "tech:ben"] },
        { a: "approve", wait: [1, 6], slow: { p: 0.34, wait: [24, 54] }, who: ["lead:cy", "lead:dee"] },
        { a: "pick", wait: [1, 4], who: ["wms"] },
        { a: "ship", wait: [1, 3], who: ["wms"] },
        { a: "receive", wait: [14, 30], who: ["dc:dock"] },
        { a: "install", wait: [1, 6], who: ["tech:ana", "tech:ben"] },
      ],
      rework: { after: "receive", via: "mismatch", back: "pick", p: 0.16, wait: [2, 8] },
      skip: { a: "approve", p: 0.06 },
    },
    tables: (evs) => [
      { name: "repair_ticket", note: "a failed part is detected", cols: ["ticket_id", "site", "opened_at"], rows: first(evs, "part failure").map((e) => [e.c, e.site, fmt(e.t)]) },
      { name: "spares_request", note: "a technician asks for a spare", cols: ["request_id", "ticket_id", "requested_by", "requested_at"], rows: first(evs, "spares request").map((e, i) => ["SR-" + (5000 + i), e.c, e.who, fmt(e.t)]) },
      { name: "approval_event", note: "who approved, and when", cols: ["ticket_id", "action", "actor", "at"], rows: first(evs, "approve").map((e) => [e.c, "APPROVE", e.who, fmt(e.t)]) },
      { name: "wms_task", note: "warehouse pick and ship", cols: ["ticket_id", "task", "done_at"], rows: evs.filter((e) => e.a === "pick" || e.a === "ship").slice(0, 6).map((e) => [e.c, e.a.toUpperCase(), fmt(e.t)]) },
    ],
    mappingLang: "sql",
    mapping: `-- One event log from the data-centre tooling tables (synthetic)
SELECT ticket_id AS case_id, 'part failure'   AS activity, opened_at    AS ts, site FROM repair_ticket
UNION ALL SELECT ticket_id, 'spares request', requested_at, site FROM spares_request JOIN repair_ticket USING (ticket_id)
UNION ALL SELECT ticket_id, lower(action),    at,           site FROM approval_event JOIN repair_ticket USING (ticket_id)
UNION ALL SELECT ticket_id, lower(task),      done_at,      site FROM wms_task       JOIN repair_ticket USING (ticket_id)
UNION ALL SELECT ticket_id, 'receive',        received_at,  site FROM dock_receipt   JOIN repair_ticket USING (ticket_id)
UNION ALL SELECT ticket_id, 'install',        closed_at,    site FROM install_event  JOIN repair_ticket USING (ticket_id);`,
  },
  dcpipe: {
    id: "dcpipe", label: "Data-centre pipeline", system: "Nexus lakehouse", flow: "data-centre asset pipeline",
    synthetic: "Synthetic sample: data-centre asset change events moving through a Nexus-style pipeline, not Meta data.",
    transit: ["landed Bronze"], queueAct: "merged Silver", fixedWait: [0.03, 0.12], fixShare: 1, slowAfter: 1, searchWord: "merge",
    fixTitle: "Publish data-centre asset changes faster",
    fixWhat: "Move the Silver merge from the nightly batch to a 5-minute micro-batch ordered by source LSN, and route rows that fail a contract to quarantine with their reason instead of failing the batch.",
    rules: [
      "Order merges by source LSN; an older event must never overwrite a newer one.",
      "A row that fails a contract goes to quarantine with its reason; one bad row never fails the batch.",
      "Replays are idempotent: merging the same events twice changes nothing.",
      "Check freshness per site before claiming an average.",
      "Use synthetic fixtures in tests; never copy production asset IDs.",
    ],
    tests: (m) => [
      `Replay the ${m.variants[0].n} clean records: all reach Gold exactly once.`,
      `p75 wait before "merged Silver" ≤ 0.25 h (15 min) at every site.`,
      `No record is published without a "validated" event.`,
      "Replaying the whole topic twice leaves Silver unchanged; re-mined fitness ≥ 0.80.",
    ],
    stopRule: "Stop and ask if a change would alter the meaning of a published Gold model.",
    outOfScope: "Source schemas, Gold model definitions, and anything outside the asset pipeline.",
    measured: "Measured at Lifepal with Nexus: reporting went from 24 h to 5 min, the nightly batch from 6 h to 90 min, and data-trust escalations fell 60%.",
    def: {
      sites: ["DC-A", "DC-B", "DC-C"],
      steps: [
        { a: "captured (CDC)", wait: [0, 0], who: ["debezium"] },
        { a: "landed Bronze", wait: [0.01, 0.08], who: ["kafka-connect"] },
        { a: "merged Silver", wait: [0.1, 0.8], slow: { p: 0.55, wait: [6, 22] }, who: ["spark:merge"] },
        { a: "validated", wait: [0.05, 0.3], who: ["dq:contracts"] },
        { a: "published Gold", wait: [0.1, 1], who: ["dbt:gold"] },
      ],
      rework: { after: "validated", via: "quarantined", back: "validated", p: 0.08, wait: [1, 8] },
      skip: { a: "validated", p: 0.03 },
    },
    tables: (evs) => {
      const key = (e: Ev) => "asset-" + (70000 + parseInt(e.c.slice(-4)));
      return [
        { name: "dcim.public.asset (Kafka topic)", note: "Debezium change events from the data-centre inventory database", cols: ["offset", "op", "lsn", "record_key", "site"], rows: evs.filter((e) => e.a === "captured (CDC)").slice(0, 6).map((e, i) => [118200 + i, i % 3 ? "u" : "c", 5_400_000 + i * 37, key(e), e.site]) },
        { name: "nexus_stage_log", note: "every stage writes one row per record: this is the pipeline's own event log", cols: ["record_key", "stage", "status", "at"], rows: evs.slice(0, 8).map((e) => [key(e), e.a, e.a === "quarantined" ? "held" : "ok", fmt(e.t)]) },
        { name: "quarantine", note: "rows that failed a contract, with the reason, until corrected and replayed", cols: ["record_key", "contract", "reason", "held_at"], rows: first(evs, "quarantined").map((e, i) => [key(e), ["asset_contract", "location_contract"][i % 2], ["rack_id not in DC-" + e.site.slice(-1) + " layout", "serial number missing"][i % 2], fmt(e.t)]) },
        { name: "gold_publish_log", note: "what reached the certified model, and when", cols: ["record_key", "model", "published_at"], rows: first(evs, "published Gold").map((e) => [key(e), "gold.asset_current", fmt(e.t)]) },
      ];
    },
    mappingLang: "sql",
    mapping: `-- The pipeline's own event log: every stage writes (record, stage, time).
-- Process mining a data pipeline works exactly like mining an ERP.
SELECT l.record_key AS case_id,
       l.stage      AS activity,     -- captured (CDC), landed Bronze, merged Silver, validated, published Gold
       l.at         AS ts,
       a.site
FROM nexus_stage_log l
JOIN silver.asset a USING (record_key)
UNION ALL
SELECT q.record_key, 'quarantined', q.held_at, a.site
FROM quarantine q
JOIN silver.asset a USING (record_key);`,
  },
  sap: {
    id: "sap", label: "SAP", system: "SAP S/4HANA", flow: "procure-to-pay", synthetic: "Synthetic sample, shaped like SAP tables. No client data.",
    transit: ["goods receipt"], queueAct: "release",
    fixTitle: "Speed up PO release",
    fixWhat: "Auto-release purchase orders under the release-strategy limit for approved vendors, and lock price fields after release so a change no longer resets the release.",
    def: {
      sites: ["1000", "2000", "3000"],
      steps: [
        { a: "create PO", wait: [0, 0], who: ["BUYER01", "BUYER02"] },
        { a: "release", wait: [1, 6], slow: { p: 0.36, wait: [24, 60] }, who: ["MGR_A", "MGR_B"] },
        { a: "goods receipt", wait: [24, 72], who: ["WH01"] },
        { a: "invoice receipt", wait: [4, 48], who: ["AP01"] },
        { a: "payment", wait: [24, 96], who: ["F110"] },
      ],
      rework: { after: "release", via: "change PO", back: "release", p: 0.18, wait: [2, 20] },
      skip: { a: "release", p: 0.05 },
    },
    tables: (evs) => [
      { name: "EKKO", note: "purchasing document header", cols: ["EBELN", "BUKRS", "ERNAM", "AEDAT"], rows: first(evs, "create PO").map((e, i) => [String(4500001000 + i), e.site, e.who, fmt(e.t).slice(0, 10)]) },
      { name: "CDHDR", note: "change documents: ME29N = release, ME22N = change", cols: ["OBJECTCLAS", "OBJECTID", "USERNAME", "UDATE", "TCODE"], rows: evs.filter((e) => e.a === "release" || e.a === "change PO").slice(0, 6).map((e) => ["EINKBELEG", String(4500001000 + parseInt(e.c.slice(-4)) - 1), e.who, fmt(e.t), e.a === "release" ? "ME29N" : "ME22N"]) },
      { name: "EKBE", note: "PO history: VGABE 1 = goods receipt, 2 = invoice", cols: ["EBELN", "VGABE", "BUDAT"], rows: evs.filter((e) => e.a === "goods receipt" || e.a === "invoice receipt").slice(0, 6).map((e) => [String(4500001000 + parseInt(e.c.slice(-4)) - 1), e.a === "goods receipt" ? "1" : "2", fmt(e.t).slice(0, 10)]) },
      { name: "BSAK", note: "cleared vendor items (payment)", cols: ["BELNR", "AUGDT"], rows: first(evs, "payment").map((e, i) => [String(1500000000 + i), fmt(e.t).slice(0, 10)]) },
    ],
    mappingLang: "sql",
    mapping: `-- Procure-to-pay event log from SAP tables
SELECT k.EBELN AS case_id, 'create PO' AS activity, k.AEDAT AS ts, k.BUKRS AS site FROM EKKO k
UNION ALL
SELECT c.OBJECTID, CASE c.TCODE WHEN 'ME29N' THEN 'release' WHEN 'ME22N' THEN 'change PO' END,
       c.UDATE + c.UTIME, k.BUKRS
FROM CDHDR c JOIN EKKO k ON k.EBELN = c.OBJECTID
WHERE c.OBJECTCLAS = 'EINKBELEG' AND c.TCODE IN ('ME29N', 'ME22N')
UNION ALL
SELECT b.EBELN, CASE b.VGABE WHEN '1' THEN 'goods receipt' WHEN '2' THEN 'invoice receipt' END, b.BUDAT, k.BUKRS
FROM EKBE b JOIN EKKO k USING (EBELN) WHERE b.VGABE IN ('1', '2')
UNION ALL
SELECT r.EBELN, 'payment', s.AUGDT, k.BUKRS     -- MM invoice → FI document (AWKEY) → cleared vendor item
FROM RSEG r
JOIN BKPF f ON f.AWTYP = 'RMRP' AND f.AWKEY = r.BELNR || r.GJAHR
JOIN BSAK s ON s.BUKRS = f.BUKRS AND s.BELNR = f.BELNR AND s.GJAHR = f.GJAHR
JOIN EKKO k ON k.EBELN = r.EBELN;`,
  },
  oracle: {
    id: "oracle", label: "Oracle", system: "Oracle E-Business Suite", flow: "requisition-to-receipt", synthetic: "Synthetic sample, shaped like Oracle EBS tables. No client data.",
    transit: ["receive"], queueAct: "approve",
    fixTitle: "Speed up requisition approval",
    fixWhat: "Route requisitions under the approval-hierarchy limit to auto-approval for catalogue items, and pre-validate charge accounts at submit so fewer requisitions are rejected.",
    def: {
      sites: ["US1", "UK1", "SG1"],
      steps: [
        { a: "create requisition", wait: [0, 0], who: ["requester:1201", "requester:1202"] },
        { a: "submit", wait: [0.2, 3], who: ["requester:1201", "requester:1202"] },
        { a: "approve", wait: [1, 6], slow: { p: 0.33, wait: [24, 58] }, who: ["approver:610", "approver:611"] },
        { a: "create PO", wait: [2, 12], who: ["buyer:701"] },
        { a: "receive", wait: [36, 96], who: ["rcv:dock"] },
        { a: "invoice", wait: [4, 40], who: ["ap:801"] },
      ],
      rework: { after: "approve", via: "reject", back: "submit", p: 0.15, wait: [1, 10] },
      skip: { a: "approve", p: 0.04 },
    },
    tables: (evs) => [
      { name: "PO_REQUISITION_HEADERS_ALL", note: "requisition header", cols: ["REQUISITION_HEADER_ID", "SEGMENT1", "ORG_ID", "CREATION_DATE"], rows: first(evs, "create requisition").map((e, i) => [9000 + i, "REQ" + (14000 + i), e.site, fmt(e.t)]) },
      { name: "PO_ACTION_HISTORY", note: "SUBMIT, APPROVE, REJECT with who and when", cols: ["OBJECT_ID", "ACTION_CODE", "EMPLOYEE_ID", "ACTION_DATE"], rows: evs.filter((e) => ["submit", "approve", "reject"].includes(e.a)).slice(0, 6).map((e) => [9000 + parseInt(e.c.slice(-4)) - 1, e.a.toUpperCase(), e.who.split(":")[1], fmt(e.t)]) },
      { name: "RCV_TRANSACTIONS", note: "receipts", cols: ["PO_HEADER_ID", "TRANSACTION_TYPE", "TRANSACTION_DATE"], rows: first(evs, "receive").map((e) => [7000 + parseInt(e.c.slice(-4)), "RECEIVE", fmt(e.t)]) },
      { name: "AP_INVOICES_ALL", note: "supplier invoices", cols: ["INVOICE_ID", "INVOICE_DATE"], rows: first(evs, "invoice").map((e, i) => [33000 + i, fmt(e.t).slice(0, 10)]) },
    ],
    mappingLang: "sql",
    mapping: `-- Requisition-to-receipt event log from Oracle EBS tables
WITH req_of_dist AS (   -- which requisition each PO distribution came from
  SELECT d.PO_DISTRIBUTION_ID, d.PO_HEADER_ID, l.REQUISITION_HEADER_ID
  FROM PO_DISTRIBUTIONS_ALL d
  JOIN PO_REQ_DISTRIBUTIONS_ALL rd ON rd.DISTRIBUTION_ID = d.REQ_DISTRIBUTION_ID
  JOIN PO_REQUISITION_LINES_ALL l ON l.REQUISITION_LINE_ID = rd.REQUISITION_LINE_ID
)
SELECT h.REQUISITION_HEADER_ID AS case_id, 'create requisition' AS activity, h.CREATION_DATE AS ts, h.ORG_ID AS site
FROM PO_REQUISITION_HEADERS_ALL h
UNION ALL
SELECT a.OBJECT_ID, lower(a.ACTION_CODE), a.ACTION_DATE, NULL            -- submit, approve, reject
FROM PO_ACTION_HISTORY a WHERE a.OBJECT_TYPE_CODE = 'REQUISITION'
UNION ALL
SELECT DISTINCT q.REQUISITION_HEADER_ID, 'create PO', p.CREATION_DATE, p.ORG_ID
FROM req_of_dist q JOIN PO_HEADERS_ALL p ON p.PO_HEADER_ID = q.PO_HEADER_ID
UNION ALL
SELECT q.REQUISITION_HEADER_ID, 'receive', r.TRANSACTION_DATE, NULL
FROM RCV_TRANSACTIONS r JOIN req_of_dist q ON q.PO_DISTRIBUTION_ID = r.PO_DISTRIBUTION_ID
WHERE r.TRANSACTION_TYPE = 'RECEIVE'
UNION ALL
SELECT q.REQUISITION_HEADER_ID, 'invoice', i.INVOICE_DATE, NULL
FROM AP_INVOICE_DISTRIBUTIONS_ALL x JOIN AP_INVOICES_ALL i ON i.INVOICE_ID = x.INVOICE_ID
JOIN req_of_dist q ON q.PO_DISTRIBUTION_ID = x.PO_DISTRIBUTION_ID;`,
  },
  odoo: {
    id: "odoo", label: "Odoo", system: "Odoo", flow: "purchase-to-bill", synthetic: "Synthetic sample, shaped like Odoo models. No client data.",
    transit: ["receipt done"], queueAct: "confirm order",
    fixTitle: "Speed up purchase approval",
    fixWhat: "Raise the two-step validation threshold for repeat orders from approved vendors (read from company settings), and block receipts on unconfirmed orders.",
    def: {
      sites: ["Bar London", "Bar Paris", "Kitchen HQ"],
      steps: [
        { a: "RFQ created", wait: [0, 0], who: ["buyer:sari", "buyer:joko"] },
        { a: "RFQ sent", wait: [0.5, 6], who: ["buyer:sari", "buyer:joko"] },
        { a: "to approve", wait: [2, 24], who: ["buyer:sari", "buyer:joko"] },
        { a: "confirm order", wait: [1, 6], slow: { p: 0.35, wait: [24, 50] }, who: ["manager:dewi"] },
        { a: "receipt done", wait: [18, 60], who: ["stock:bar"] },
        { a: "bill posted", wait: [4, 36], who: ["account:ap"] },
      ],
      rework: { after: "receipt done", via: "return", back: "receipt done", p: 0.12, wait: [2, 12] },
      skip: { a: "confirm order", p: 0.05 },
    },
    tables: (evs) => [
      { name: "purchase_order", note: "model purchase.order", cols: ["name", "state", "date_order", "picking_type_id"], rows: first(evs, "RFQ created").map((e, i) => ["P" + String(1000 + i).padStart(5, "0"), "purchase", fmt(e.t), e.site]) },
      { name: "mail_tracking_value", note: "chatter: every state change, who and when", cols: ["mail_message_id → res_id", "field", "old_value_char", "new_value_char", "create_date"], rows: evs.filter((e) => ["RFQ sent", "to approve", "confirm order"].includes(e.a)).slice(0, 6).map((e) => ["P" + String(1000 + parseInt(e.c.slice(-4)) - 1).padStart(5, "0"), "state", e.a === "RFQ sent" ? "draft" : e.a === "to approve" ? "sent" : "to approve", e.a === "RFQ sent" ? "sent" : e.a === "to approve" ? "to approve" : "purchase", fmt(e.t)]) },
      { name: "stock_picking", note: "receipts and returns", cols: ["name", "origin", "state", "date_done"], rows: evs.filter((e) => e.a === "receipt done" || e.a === "return").slice(0, 6).map((e, i) => [(e.a === "return" ? "WH/RET/" : "WH/IN/") + String(i + 1).padStart(5, "0"), "P" + String(1000 + parseInt(e.c.slice(-4)) - 1).padStart(5, "0"), "done", fmt(e.t)]) },
      { name: "account_move", note: "vendor bills", cols: ["name", "invoice_origin", "state", "invoice_date"], rows: first(evs, "bill posted").map((e, i) => ["BILL/2026/" + String(i + 1).padStart(4, "0"), "P" + String(1000 + parseInt(e.c.slice(-4)) - 1).padStart(5, "0"), "posted", fmt(e.t).slice(0, 10)]) },
    ],
    mappingLang: "sql",
    mapping: `-- Purchase-to-bill event log from Odoo's PostgreSQL tables
SELECT po.name AS case_id, 'RFQ created' AS activity, po.create_date AS ts, pt.name AS site
FROM purchase_order po JOIN stock_picking_type pt ON pt.id = po.picking_type_id
UNION ALL
SELECT po.name,                                         -- every state change is in the chatter
       CASE v.new_value_char WHEN 'sent' THEN 'RFQ sent' WHEN 'to approve' THEN 'to approve'
                             WHEN 'purchase' THEN 'confirm order' END,
       v.create_date, NULL
FROM mail_tracking_value v
JOIN mail_message m ON m.id = v.mail_message_id AND m.model = 'purchase.order'
JOIN purchase_order po ON po.id = m.res_id
JOIN ir_model_fields f ON f.id = v.field_id AND f.name = 'state'
UNION ALL
SELECT sp.origin, CASE WHEN sp.name LIKE '%/RET/%' THEN 'return' ELSE 'receipt done' END, sp.date_done, NULL
FROM stock_picking sp WHERE sp.state = 'done'
UNION ALL
SELECT am.invoice_origin, 'bill posted', am.write_date, NULL
FROM account_move am WHERE am.move_type = 'in_invoice' AND am.state = 'posted';`,
  },
};
