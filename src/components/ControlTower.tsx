import { useMemo, useReducer, useState } from "react";
import { PARTS, SITES, approvalSplit, mineTower, partOf, rop, seed, type Req, type Site, type Status, type Tower } from "../data/tower";

/* A working back-office mockup: Spares Control Tower. Benchmarks: Flexport's control tower (live status),
   Syncron (service-parts planning), MaintainX (work orders), Retool / Linear (approvals inbox).
   Synthetic data. Every action writes an event, and the Process tab mines the tower's own log. */

type Action =
  | { type: "approve"; id: string; who: string; how: string }
  | { type: "reject"; id: string; reason: string }
  | { type: "advance"; id: string }
  | { type: "rma"; id: string }
  | { type: "recall"; lot: string }
  | { type: "auto"; on: boolean }
  | { type: "arrive" }
  | { type: "reset" };

type State = Tower & { auto: boolean; autoSince: number | null; toast: string; arrived: number };
const ME = "lead:cy";
const NEXT: Partial<Record<Status, Status>> = { approved: "picked", picked: "shipped", shipped: "received", received: "installed" };
const VERB: Partial<Record<Status, string>> = { approved: "Pick (FIFO)", picked: "Ship", shipped: "Receive", received: "Install" };

export const stockAt = (s: State | Tower, part: string, site: Site) => s.lots.filter((l) => l.part === part && l.site === site && l.status === "available").reduce((a, l) => a + l.qty, 0);

/** The agent's checks for one request: what it would decide, and why */
export function checks(s: State, r: Req) {
  const p = partOf(r.part), stock = stockAt(s, r.part, r.site);
  const ruleHit = s.rules.find((x) => x.source !== "seed" && ((x.part ? x.part === r.part : x.text.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])) && (!x.site || x.site === r.site)));
  const list = [
    { ok: r.likeForLike, text: r.likeForLike ? "Like-for-like replacement" : "Not like-for-like (an upgrade or a different part)" },
    { ok: r.qty <= p.limit, text: `Quantity ${r.qty} ${r.qty <= p.limit ? "≤" : ">"} limit ${p.limit} for ${p.name}` },
    { ok: stock >= r.qty, text: `Stock at ${r.site}: ${stock} available` },
    { ok: !ruleHit, text: ruleHit ? `Rule from a past review applies: “${ruleHit.text}”` : "No rule from past reviews blocks it" },
  ];
  return { list, safe: list.every((c) => c.ok) };
}

function reducer(s: State, a: Action): State {
  const now = +(s.now + 0.3).toFixed(2);
  const log = (c: string, act: string, who: string, site: Site, detail = "") => ({ id: s.nextEv, case: c, act, t: now, who, site, detail });
  const upd = (id: string, f: (r: Req) => Req) => s.reqs.map((r) => (r.id === id ? f(r) : r));
  switch (a.type) {
    case "approve": {
      const r = s.reqs.find((x) => x.id === a.id)!;
      return { ...s, now, reqs: upd(a.id, (x) => ({ ...x, status: "approved" })), log: [...s.log, log(r.id, "approved", a.who, r.site, a.how)], nextEv: s.nextEv + 1, toast: `${r.id} approved by ${a.who}`, examples: a.how.includes("AI") ? [...s.examples, `${partOf(r.part).name} × ${r.qty} at ${r.site}`] : s.examples };
    }
    case "reject": {
      const r = s.reqs.find((x) => x.id === a.id)!;
      return { ...s, now, reqs: upd(a.id, (x) => ({ ...x, status: "rejected", note: a.reason })), log: [...s.log, log(r.id, "rejected", ME, r.site, a.reason)], nextEv: s.nextEv + 1, rules: [...s.rules, { text: a.reason, source: `review of ${r.id}`, part: r.part, site: r.site }], toast: `${r.id} rejected. Your reason is now a rule for ${partOf(r.part).name} at ${r.site}.` };
    }
    case "advance": {
      const r = s.reqs.find((x) => x.id === a.id)!, next = NEXT[r.status];
      if (!next) return s;
      let lots = s.lots, detail = "";
      if (next === "picked") {
        // FIFO: oldest available lot first, spanning lots if needed
        let need = r.qty; const used: string[] = [];
        const fifo = s.lots.filter((l) => l.part === r.part && l.site === r.site && l.status === "available" && l.qty > 0).sort((x, y) => x.received - y.received);
        if (fifo.reduce((t, l) => t + l.qty, 0) < need) return { ...s, toast: `Not enough ${partOf(r.part).name} at ${r.site} to pick ${r.qty}.` };
        lots = s.lots.map((l) => { if (!fifo.includes(l) || need <= 0) return l; const take = Math.min(l.qty, need); need -= take; used.push(`${l.id}×${take}`); return { ...l, qty: l.qty - take }; });
        detail = "FIFO " + used.join(", ");
      }
      return { ...s, now, lots, reqs: upd(a.id, (x) => ({ ...x, status: next, lot: detail || x.lot })), log: [...s.log, log(r.id, next, next === "installed" ? r.requester : next === "received" ? "dock" : "wms", r.site, detail)], nextEv: s.nextEv + 1, toast: `${r.id}: ${next}${detail ? " · " + detail : ""}` };
    }
    case "rma": {
      const r = s.reqs.find((x) => x.id === a.id)!;
      return { ...s, now, reqs: upd(a.id, (x) => ({ ...x, status: "approved" })), log: [...s.log, log(r.id, "rma opened", r.requester, r.site, "mismatch at install, re-pick")], nextEv: s.nextEv + 1, toast: `${r.id}: RMA opened, back to pick (the rework loop)` };
    }
    case "recall": {
      const hit = s.log.filter((e) => e.detail.includes(a.lot + "×")).map((e) => e.case);
      return { ...s, now, lots: s.lots.map((l) => (l.id === a.lot ? { ...l, status: "recalled" } : l)), toast: `${a.lot} recalled. Orders that used it: ${hit.length ? [...new Set(hit)].join(", ") : "none yet"}.` };
    }
    case "auto": return { ...s, auto: a.on, autoSince: a.on ? (s.autoSince ?? s.now) : s.autoSince, toast: a.on ? "Auto-approve within limits is on. New requests that pass every check are approved at once." : "Auto-approve is off. Every request waits for a person." };
    case "arrive": {
      // three new requests arrive; with auto-approve on, safe ones are approved at once
      let st: State = { ...s };
      for (let k = 0; k < 3; k++) {
        const n = st.arrived + k, site = SITES[n % 3], p = PARTS[(n * 3) % PARTS.length], id = `WO-${3000 + n}`;
        const r: Req = { id, ticket: `T-${89000 + n}`, part: p.id, site, qty: n % 4 === 3 ? p.limit + 1 : 1, likeForLike: n % 5 !== 4, requester: ["tech:ana", "tech:ben", "tech:kofi"][n % 3], created: st.now, status: "awaiting approval" };
        st = { ...st, reqs: [...st.reqs, r], log: [...st.log, { id: st.nextEv, case: id, act: "requested", t: st.now, who: r.requester, site, detail: `${p.name} × ${r.qty}` }], nextEv: st.nextEv + 1 };
        if (st.auto && checks(st, r).safe) {
          st = { ...st, reqs: st.reqs.map((x) => (x.id === id ? { ...x, status: "approved" } : x)), log: [...st.log, { id: st.nextEv, case: id, act: "approved", t: +(st.now + 0.15).toFixed(2), who: "auto (within limits)", site, detail: "all checks passed" }], nextEv: st.nextEv + 1 };
        }
      }
      // time passes while unapproved requests wait
      return { ...st, now: +(st.now + (st.auto ? 1 : 8)).toFixed(2), arrived: st.arrived + 3, toast: st.auto ? "3 new requests: the safe ones were approved at once; the rest wait for you." : "3 new requests are waiting for a person." };
    }
    case "reset": return init();
  }
}
const init = (): State => ({ ...seed(), auto: false, autoSince: null, toast: "", arrived: 0 });

const BASE = Date.UTC(2026, 10, 10);
const when = (t: number) => { const d = new Date(BASE + t * 3600e3); return d.toUTCString().slice(5, 11) + " " + d.toISOString().slice(11, 16); };
const ago = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} d`);

const TABS = ["Overview", "Approval policy", "Work orders", "Lots", "Process", "Audit"] as const;
type Tab = (typeof TABS)[number];

export function ControlTower() {
  const [s, dispatch] = useReducer(reducer, undefined, init);
  const [tab, setTab] = useState<Tab>("Overview");
  const [site, setSite] = useState<"All" | Site>("All");
  const [sel, setSel] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [part, setPart] = useState(PARTS[0].id);
  const [q, setQ] = useState("");
  const mined = useMemo(() => mineTower(s.log), [s.log]);
  const inSite = (x: { site: Site }) => site === "All" || x.site === site;
  const waiting = s.reqs.filter((r) => r.status === "awaiting approval" && inSite(r)).sort((a, b) => a.created - b.created);
  const below = PARTS.flatMap((p) => SITES.filter((x) => site === "All" || x === site).map((x) => ({ p, x, on: stockAt(s, p.id, x), rop: rop(p, x) }))).filter((r) => r.on < r.rop);
  const cur = s.reqs.find((r) => r.id === (sel ?? waiting[0]?.id));
  const approvalP75 = mined.waits.find((w) => w.a === "approved")?.p75 ?? 0;
  const split = useMemo(() => approvalSplit(s.log, s.autoSince), [s.log, s.autoSince]);
  const counts: Record<Tab, number | undefined> = { Overview: undefined, "Approval policy": waiting.length, "Work orders": s.reqs.filter((r) => ["approved", "picked", "shipped", "received"].includes(r.status) && inSite(r)).length, Lots: undefined, Process: undefined, Audit: undefined };

  return (
    <div className="tower" aria-label="Spares Control Tower, a back-office mockup">
      <header className="tw-top">
        <div className="tw-brand"><b>Spares Control Tower</b><span className="tag-syn">synthetic mockup</span></div>
        <div className="seg" role="group" aria-label="Data centre">{(["All", ...SITES] as const).map((x) => <button key={x} aria-pressed={site === x} onClick={() => setSite(x)}>{x}</button>)}</div>
        <div className="tw-me"><span aria-hidden="true">●</span> {ME} · approver</div>
      </header>
      <div className="tw-body">
        <nav className="tw-nav" aria-label="Control tower sections">
          {TABS.map((t) => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>{t}{counts[t] ? <em>{counts[t]}</em> : null}</button>)}
          <button className="tw-reset" onClick={() => { dispatch({ type: "reset" }); setSel(null); }}>Reset demo</button>
        </nav>
        <section className="tw-main" aria-live="polite">
          {s.toast && <div className="tw-toast" role="status">{s.toast}</div>}

          {tab === "Overview" && (<>
            <div className="tw-kpis">
              <div className={"tw-kpi" + (below.length ? " bad" : "")}><b>{below.length}</b><span>parts below reorder point</span></div>
              <div className={"tw-kpi" + (waiting.filter((r) => s.now - r.created > 24).length ? " bad" : "")}><b>{waiting.filter((r) => s.now - r.created > 24).length}</b><span>approvals waiting &gt; 24 h</span></div>
              <div className="tw-kpi"><b>{ago(approvalP75)}</b><span>p75 approval wait (mined)</span></div>
              <div className="tw-kpi"><b>{s.log.filter((e) => e.act === "rma opened").length}</b><span>RMAs (rework)</span></div>
            </div>
            <div className="tw-alert">
              <b>Mined from this tower's log:</b> the slowest step is <b>{mined.bottleneck.a}</b> (p75 {ago(mined.bottleneck.p75)}). Approval p75 by site: {mined.bySite.map((x) => `${x.site} ${ago(x.p75)}`).join(" · ")}.
              <button className="btn btn-ghost" onClick={() => setTab("Process")}>See the process →</button>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>Part</th>{SITES.filter((x) => site === "All" || x === site).map((x) => <th key={x} className="num">{x} on hand / ROP</th>)}</tr></thead>
              <tbody>{PARTS.map((p) => (
                <tr key={p.id}><td><b>{p.name}</b></td>{SITES.filter((x) => site === "All" || x === site).map((x) => { const on = stockAt(s, p.id, x), r = rop(p, x); return <td key={x} className={"num" + (on < r ? " tw-low" : "")}>{on} / {r}{on < r ? " ⚠" : ""}</td>; })}</tr>
              ))}</tbody>
            </table></div>
            <p className="small muted">ROP = μL + zσ√L at a 95% service level. ⚠ means on-hand is below the reorder point.</p>
          </>)}

          {tab === "Approval policy" && (
            <div className="tw-inbox">
              <div className="tw-list" role="listbox" aria-label="Requests waiting for approval">
                <p className="small muted" style={{ margin: 0 }}>The policy view. For one-by-one triage, use the <a href="#inbox">Approvals inbox</a> (back-office 1).</p>
                <div className="tw-auto">
                  <label><input type="checkbox" checked={s.auto} onChange={(e) => dispatch({ type: "auto", on: e.target.checked })} /> Auto-approve within limits <small>(the Fettle fix)</small></label>
                  <button className="btn btn-ghost" onClick={() => dispatch({ type: "arrive" })}>Simulate 3 new requests</button>
                </div>
                {waiting.length === 0 && <p className="small muted">Inbox zero.</p>}
                {waiting.map((r) => {
                  const ok = checks(s, r).safe, age = s.now - r.created;
                  return (
                    <button key={r.id} role="option" aria-selected={cur?.id === r.id} className={"tw-item" + (cur?.id === r.id ? " on" : "")} onClick={() => { setSel(r.id); setReason(""); }}>
                      <span className="tw-item-top"><b>{r.id}</b><span className={age > 24 ? "tw-late" : ""}>⏱ {ago(age)}</span></span>
                      <span>{partOf(r.part).name} × {r.qty} · {r.site}</span>
                      <span className={ok ? "tw-ai ok" : "tw-ai"}>{ok ? "AI: approve, all checks pass" : "AI: needs a person"}</span>
                    </button>
                  );
                })}
              </div>
              {cur && cur.status === "awaiting approval" ? (() => {
                const c = checks(s, cur), sp = mined.bySite.find((x) => x.site === cur.site)!, stock = stockAt(s, cur.part, cur.site), r0 = rop(partOf(cur.part), cur.site);
                return (
                  <div className="tw-detail">
                    <h4>{cur.id} · {partOf(cur.part).name} × {cur.qty} for {cur.site}</h4>
                    <p className="small muted">Ticket {cur.ticket} · requested by {cur.requester} · waiting {ago(s.now - cur.created)}</p>
                    <div className="tw-ctx">
                      <b>Mined context</b>
                      <span>Approvals at {cur.site}: p75 {ago(sp.p75)} over {sp.n} past orders</span>
                      <span>Stock at {cur.site}: {stock} on hand, reorder point {r0}{stock - cur.qty < r0 ? " · this pick takes it below ROP" : ""}</span>
                    </div>
                    <div className={"tw-sugg" + (c.safe ? " ok" : "")}>
                      <b>{c.safe ? "Agent suggests: approve" : "Agent suggests: a person should decide"}</b>
                      <ul>{c.list.map((x) => <li key={x.text} className={x.ok ? "ok" : "no"}>{x.ok ? "✓" : "✗"} {x.text}</li>)}</ul>
                    </div>
                    <div className="row">
                      <button className="btn btn-primary" onClick={() => { dispatch({ type: "approve", id: cur.id, who: ME, how: c.safe ? "person, AI-suggested" : "person" }); setSel(null); }}>Approve</button>
                      <input className="tw-reason" placeholder="Reason to reject (becomes a rule)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason to reject" />
                      <button className="btn btn-ghost" disabled={reason.trim().length < 6} onClick={() => { dispatch({ type: "reject", id: cur.id, reason: reason.trim() }); setSel(null); setReason(""); }}>Reject</button>
                    </div>
                    <p className="small muted" style={{ marginTop: 10 }}>The agent never approves on its own unless auto-approve is on, and then only within the limits above. A person approves everything else.</p>
                  </div>
                );
              })() : <div className="tw-detail"><p className="muted">Select a request.</p></div>}
            </div>
          )}

          {tab === "Work orders" && (
            <div className="tw-board">
              {(["approved", "picked", "shipped", "received"] as Status[]).map((st) => (
                <div className="tw-col" key={st}>
                  <h4>{st}<span>{s.reqs.filter((r) => r.status === st && inSite(r)).length}</span></h4>
                  {s.reqs.filter((r) => r.status === st && inSite(r)).map((r) => (
                    <div className="tw-card" key={r.id}>
                      <b>{r.id}</b> {partOf(r.part).name} × {r.qty}
                      <small>{r.site}{r.lot ? " · " + r.lot : ""}</small>
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <button className="btn btn-primary tw-sm" onClick={() => dispatch({ type: "advance", id: r.id })}>{VERB[st]}</button>
                        {st === "received" && <button className="btn btn-ghost tw-sm" onClick={() => dispatch({ type: "rma", id: r.id })}>Mismatch → RMA</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="tw-col done"><h4>installed<span>{s.reqs.filter((r) => r.status === "installed" && inSite(r)).length}</span></h4><p className="small muted">Closed work orders. History lives in Audit.</p></div>
            </div>
          )}

          {tab === "Lots" && (<>
            <div className="seg" role="group" aria-label="Part">{PARTS.map((p) => <button key={p.id} aria-pressed={part === p.id} onClick={() => setPart(p.id)}>{p.name}</button>)}</div>
            <div className="table-wrap mt"><table>
              <thead><tr><th>Lot</th><th>Site</th><th>Received</th><th className="num">On hand</th><th>Status</th><th></th></tr></thead>
              <tbody>{s.lots.filter((l) => l.part === part && inSite(l)).sort((a, b) => a.site.localeCompare(b.site) || a.received - b.received).map((l, k, arr) => (
                <tr key={l.id} className={l.status === "recalled" ? "below" : ""}>
                  <td><b>{l.id}</b>{k === arr.findIndex((x) => x.site === l.site && x.status === "available" && x.qty > 0) ? <span className="tw-fifo">next FIFO</span> : null}</td>
                  <td>{l.site}</td><td>{when(l.received)}</td><td className="num">{l.qty}</td><td>{l.status}</td>
                  <td>{l.status === "available" && <button className="btn btn-ghost tw-sm" onClick={() => dispatch({ type: "recall", lot: l.id })}>Recall</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="small muted">Picks take the oldest available lot first. A recall lists every work order that used the lot.</p>
          </>)}

          {tab === "Process" && (<>
            <div className="tw-kpis">
              <div className="tw-kpi bad"><b>{ago(split.before.p75)}</b><span>p75 approval wait before auto-approve ({split.before.n} orders)</span></div>
              <div className={"tw-kpi" + (split.after.n ? " good" : "")}><b>{split.after.n ? ago(split.after.p75) : "–"}</b><span>{split.after.n ? `p75 since auto-approve was switched on (${split.after.n} orders)` : "switch on auto-approve in Approval policy, then simulate new requests"}</span></div>
            </div>
            <div className="tw-alert"><b>This tab mines the tower's own event log.</b> {mined.events} events across {mined.cases} work orders, and every click in the tower adds one. Turn on auto-approve in Approval policy, simulate new requests, and watch the approval wait change here.</div>
            <div className="split even">
              <div className="bars">
                {mined.waits.map((w) => { const max = mined.waits[0].p75 || 1; const isB = w.a === mined.bottleneck.a; return (
                  <div className="bar-row" key={w.a}><span className="lab">before “{w.a}”{isB ? <small style={{ color: "var(--bad)" }}> · bottleneck</small> : null}</span><span className={"bar " + (isB ? "before" : "after")}><i style={{ width: `${(w.p75 / max) * 100}%` }} /></span><span className="val">{ago(w.p75)}</span></div>
                ); })}
                <p className="small muted">p75 wait before each step. Dock transit is left out because it isn't a queue.</p>
              </div>
              <div>
                <div className="table-wrap"><table><thead><tr><th>Variant</th><th className="num">orders</th></tr></thead><tbody>{mined.variants.slice(0, 4).map((v) => <tr key={v.k}><td>{v.k}</td><td className="num">{v.n}</td></tr>)}</tbody></table></div>
                <div className="row mt">
                  <button className="btn btn-ghost" onClick={() => { const csv = "case_id,activity,timestamp,site,who,detail\n" + s.log.map((e) => [e.case, e.act, new Date(BASE + e.t * 3600e3).toISOString(), e.site, e.who, JSON.stringify(e.detail)].join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "control-tower-event-log.csv"; a.click(); URL.revokeObjectURL(a.href); }}>Download event log (CSV)</button>
                  <a className="btn btn-ghost" href="fettle.html?try=metadc#lab">Mine it in the Process Lab →</a>
                </div>
              </div>
            </div>
            <h4 className="mt">Rules the agent reads first ({s.rules.length})</h4>
            <ul className="small">{s.rules.map((r, k) => <li key={k}>{r.text} <span className="muted">· {r.source}</span></li>)}</ul>
            {s.examples.length > 0 && <><h4>Approved examples ({s.examples.length})</h4><ul className="small">{s.examples.map((x, k) => <li key={k}>{x}</li>)}</ul></>}
          </>)}

          {tab === "Audit" && (<>
            <input className="tw-reason" placeholder="Filter by work order, e.g. WO-2004" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit trail" style={{ maxWidth: 320 }} />
            <div className="table-wrap mt"><table>
              <thead><tr><th>When</th><th>Work order</th><th>What</th><th>Who</th><th>Site</th><th>Detail</th></tr></thead>
              <tbody>{[...s.log].filter((e) => inSite(e) && (!q || e.case.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.t - a.t || b.id - a.id).slice(0, 40).map((e) => (
                <tr key={e.id}><td>{when(e.t)}</td><td><b>{e.case}</b></td><td>{e.act}</td><td>{e.who}</td><td>{e.site}</td><td>{e.detail}</td></tr>
              ))}</tbody>
            </table></div>
            <p className="small muted">Where each item is, who touched it last, and what it's waiting for: every change is here.</p>
          </>)}
        </section>
      </div>
      <p className="tw-foot small muted">Benchmarks: Flexport's control tower (live status), Syncron (service-parts planning), MaintainX (work orders), Retool and Linear (approvals inbox). Synthetic data for a possible data-centre spares operation; not Meta data.</p>
    </div>
  );
}
