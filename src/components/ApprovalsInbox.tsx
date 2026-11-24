import { useMemo, useReducer, useState } from "react";
import { SITES, fifoLots, mineTower, partOf, rop, seed, stockOf, type Req, type Site, type Tower } from "../data/tower";

/* Approvals Inbox + AI. Benchmarks: Retool (internal-tool back-offices) and Linear (inbox triage).
   Fettle's ideas made concrete: every request carries mined context; the AI suggests with visible checks;
   a person decides; a rejection reason becomes a rule; an approved decision becomes an example;
   and every click is an event, so the inbox mines its own log. SYNTHETIC data. */

const ME = "lead:you";
type Act =
  | { type: "approve"; id: string; ai: boolean }
  | { type: "reject"; id: string; reason: string }
  | { type: "ask"; id: string }
  | { type: "reset" };

function reduce(t: Tower, a: Act): Tower {
  if (a.type === "reset") return seed();
  const now = +(t.now + 0.1).toFixed(2);
  const req = t.reqs.find((r) => r.id === a.id)!;
  const ev = (act: string, detail = "") => ({ id: t.nextEv, case: req.id, act, t: now, who: ME, site: req.site, detail });
  if (a.type === "approve") {
    // reserve stock FIFO: oldest lot first
    let left = req.qty; const used: string[] = [];
    const lots = t.lots.map((l) => ({ ...l }));
    for (const l of lots.filter((x) => x.part === req.part && x.site === req.site && x.status === "available" && x.qty > 0).sort((x, y) => x.received - y.received)) {
      if (left <= 0) break; const take = Math.min(l.qty, left); l.qty -= take; left -= take; used.push(`${l.id}×${take}`);
    }
    const p = partOf(req.part);
    return {
      ...t, now, lots, nextEv: t.nextEv + 1,
      reqs: t.reqs.map((r) => (r.id === req.id ? { ...r, status: "approved", lot: used.join(", ") } : r)),
      log: [...t.log, ev("approved", `${a.ai ? "AI-suggested, " : ""}reserved ${used.join(", ") || "none"}`)],
      examples: a.ai ? [...t.examples, `${p.name} × ${req.qty} at ${req.site}: like-for-like, within the limit of ${p.limit}, stock available → approved by a person`] : t.examples,
    };
  }
  if (a.type === "reject") {
    return {
      ...t, now, nextEv: t.nextEv + 1,
      reqs: t.reqs.map((r) => (r.id === req.id ? { ...r, status: "rejected", note: a.reason } : r)),
      log: [...t.log, ev("rejected", a.reason)],
      rules: [...t.rules, { text: a.reason, source: `review of ${req.id}`, part: req.part, site: req.site }],
    };
  }
  return { ...t, now, nextEv: t.nextEv + 1, log: [...t.log, ev("info requested", "asked the requester for the failed part's serial")] };
}

type Check = { ok: boolean; warn?: boolean; text: string };
function suggest(t: Tower, r: Req): { checks: Check[]; safe: boolean; verdict: string } {
  const p = partOf(r.part), stock = stockOf(t, r.part, r.site), R = rop(p, r.site);
  const rule = t.rules.find((x) => x.part === r.part && x.site === r.site);
  const checks: Check[] = [
    { ok: r.likeForLike, text: r.likeForLike ? "Like-for-like replacement for the failed part" : "Not like-for-like: the requested part differs from the failed one" },
    { ok: r.qty <= p.limit, text: r.qty <= p.limit ? `Quantity ${r.qty} is within the agreed limit of ${p.limit}` : `Quantity ${r.qty} is above the agreed limit of ${p.limit}` },
    { ok: stock >= r.qty, text: stock >= r.qty ? `In stock at ${r.site}: ${stock} on hand` : `Only ${stock} on hand at ${r.site}` },
    { ok: true, warn: stock - r.qty < R, text: stock - r.qty < R ? `After this pick ${stock - r.qty} < reorder point ${R}: reorder flagged` : `After this pick ${stock - r.qty} stays above reorder point ${R}` },
    { ok: !rule, text: rule ? `Rule from ${rule.source}: “${rule.text}”` : "No rule from past reviews blocks this" },
  ];
  const safe = checks.every((c) => c.ok);
  const why = checks.filter((c) => !c.ok).map((c) => c.text.toLowerCase());
  return { checks, safe, verdict: safe ? "Suggest: approve" : `Needs a person: ${why[0]}` };
}

const age = (t: Tower, r: Req) => t.now - r.created;
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

export function ApprovalsInbox() {
  const [t, dispatch] = useReducer(reduce, undefined, seed);
  const [site, setSite] = useState<Site | "all">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<"process" | "rules" | "audit">("process");
  const [reason, setReason] = useState("");
  const [confirmBulk, setConfirmBulk] = useState(false);

  const queue = useMemo(() => t.reqs.filter((r) => r.status === "awaiting approval" && (site === "all" || r.site === site)).sort((a, b) => a.created - b.created), [t, site]);
  const current = queue.find((r) => r.id === sel) || queue[0];
  const mined = useMemo(() => mineTower(t.log), [t.log]);
  const aiSafe = queue.filter((r) => suggest(t, r).safe);
  const s = current ? suggest(t, current) : null;
  const siteP75 = (x: Site) => mined.bySite.find((b) => b.site === x)?.p75 || 0;
  const pastApprovals = useMemo(() => {
    const byCase = new Map<string, number>(); const waits: number[] = [];
    for (const e of t.log) { if (e.act === "requested") byCase.set(e.case, e.t); if (e.act === "approved" && byCase.has(e.case)) waits.push(e.t - byCase.get(e.case)!); }
    return waits;
  }, [t.log]);
  const olderThan = current ? Math.round((pastApprovals.filter((w) => w < age(t, current)).length / Math.max(1, pastApprovals.length)) * 100) : 0;
  const decided = t.log.filter((e) => e.who === ME).length;
  const openAll = t.reqs.filter((r) => r.status === "awaiting approval");
  const ages = openAll.map((r) => age(t, r)).sort((a, b) => a - b);
  const oldest = ages[ages.length - 1] || 0, medianOpen = ages.length ? ages[Math.floor((ages.length - 1) / 2)] : 0;

  return (
    <div className="inbox">
      <div className="ib-top">
        <div>
          <b className="ib-title">Spares approvals</b>
          <span className="ib-sub">signed in as <code>{ME}</code> · approver · synthetic data</span>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Filter by site">
            {(["all", ...SITES] as const).map((x) => <button key={x} aria-pressed={site === x} onClick={() => { setSite(x); setSel(null); }}>{x === "all" ? "All sites" : x}</button>)}
          </div>
          <button className="btn btn-ghost" style={{ padding: "7px 12px" }} onClick={() => { dispatch({ type: "reset" }); setSel(null); setConfirmBulk(false); }}>Reset demo</button>
        </div>
      </div>

      <div className="ib-grid">
        {/* the queue */}
        <section className="ib-list" aria-label="Requests awaiting approval">
          <div className="ib-list-head">
            <span>Inbox <b>{queue.length}</b></span>
            {aiSafe.length > 0 && (confirmBulk
              ? <span className="row"><button className="btn btn-primary ib-mini" onClick={() => { aiSafe.forEach((r) => dispatch({ type: "approve", id: r.id, ai: true })); setConfirmBulk(false); setSel(null); }}>Approve {aiSafe.length} as {ME}</button><button className="btn btn-ghost ib-mini" onClick={() => setConfirmBulk(false)}>Cancel</button></span>
              : <button className="btn btn-ghost ib-mini" onClick={() => setConfirmBulk(true)}>Review {aiSafe.length} AI-safe…</button>)}
          </div>
          {queue.length === 0 && <p className="small muted" style={{ padding: 12 }}>Inbox zero: nothing is waiting. The Process tab shows the queue age at zero, and what the decisions added to history.</p>}
          {queue.map((r) => {
            const sg = suggest(t, r), a = age(t, r), p = partOf(r.part);
            return (
              <button key={r.id} className={"ib-item" + (current?.id === r.id ? " on" : "")} onClick={() => { setSel(r.id); setReason(""); }}>
                <span className="ib-row1"><b>{p.name} × {r.qty}</b><span className={"ib-age" + (a > 24 ? " late" : "")}>⏱ {hrs(a)}</span></span>
                <span className="ib-row2">{r.id} · {r.site} · {r.requester}</span>
                <span className={"ib-ai " + (sg.safe ? "ok" : "hold")}>{sg.safe ? "AI: safe to approve" : "AI: needs a person"}</span>
              </button>
            );
          })}
        </section>

        {/* the request */}
        <section className="ib-detail" aria-label="Request detail" aria-live="polite">
          {!current ? <p className="muted">Nothing waiting{site !== "all" ? ` at ${site}` : ""}.</p> : (<>
            <div className="ib-head">
              <div><span className="eyebrow" style={{ margin: 0 }}>{current.id} · ticket {current.ticket}</span>
                <h3>{partOf(current.part).name} × {current.qty} <small>for {current.site}</small></h3>
                <p className="small muted" style={{ margin: 0 }}>Requested by {current.requester}, waiting <b className={age(t, current) > 24 ? "bad" : ""}>{hrs(age(t, current))}</b></p></div>
            </div>
            <div className="ib-cards">
              <div className="ib-card">
                <span className="ib-k">Mined context</span>
                <p>Approvals at <b>{current.site}</b> take <b>{hrs(siteP75(current.site))}</b> at p75, against {SITES.filter((x) => x !== current.site).map((x) => `${x} ${hrs(siteP75(x))}`).join(", ")}.</p>
                <p>This request has already waited longer than <b>{olderThan}%</b> of past approvals.</p>
              </div>
              <div className="ib-card">
                <span className="ib-k">Stock and FIFO</span>
                <p>{stockOf(t, current.part, current.site)} on hand · reorder point <b>{rop(partOf(current.part), current.site)}</b> (μL + zσ√L, 95%).</p>
                <p>Would reserve: {fifoLots(t, current.part, current.site).slice(0, 2).map((l) => `${l.id} (${l.qty})`).join(" → ") || "nothing available"}, oldest first.</p>
              </div>
            </div>
            <div className={"ib-suggest " + (s!.safe ? "ok" : "hold")}>
              <div className="ib-verdict"><span className="ib-k">AI suggestion</span><b>{s!.verdict}</b></div>
              <ul>{s!.checks.map((c, k) => <li key={k} className={!c.ok ? "no" : c.warn ? "warn" : "yes"}><i aria-hidden="true">{!c.ok ? "✗" : c.warn ? "!" : "✓"}</i>{c.text}</li>)}</ul>
              <p className="small muted" style={{ margin: "6px 0 0" }}>The AI never approves. A person does, and the decision is recorded under their name.</p>
            </div>
            <div className="ib-actions">
              <button className="btn btn-primary" onClick={() => { dispatch({ type: "approve", id: current.id, ai: s!.safe }); setSel(null); }}>Approve</button>
              <input className="ib-reason" placeholder="Reason, required to reject (becomes a rule)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Rejection reason" />
              <button className="btn btn-ghost" disabled={reason.trim().length < 8} onClick={() => { dispatch({ type: "reject", id: current.id, reason: reason.trim() }); setReason(""); setSel(null); }}>Reject</button>
              <button className="btn btn-ghost" onClick={() => dispatch({ type: "ask", id: current.id })}>Ask requester</button>
            </div>
          </>)}
        </section>
      </div>

      {/* what the inbox learned, and its own process */}
      <div className="ib-foot">
        <div className="seg" role="tablist" aria-label="Insights">
          <button role="tab" aria-selected={tab === "process"} onClick={() => setTab("process")}>Process (mined live)</button>
          <button role="tab" aria-selected={tab === "rules"} onClick={() => setTab("rules")}>Rules &amp; examples ({t.rules.length + t.examples.length})</button>
          <button role="tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Audit trail</button>
        </div>
        {tab === "process" && (
          <div className="ib-process">
            <div>
              <div className="ib-queue">
                <div><b className={openAll.length ? "" : "good"}>{openAll.length}</b><span>open approvals</span></div>
                <div><b className={oldest > 24 ? "bad" : ""}>{openAll.length ? hrs(oldest) : "–"}</b><span>oldest waiting</span></div>
                <div><b>{openAll.length ? hrs(medianOpen) : "–"}</b><span>median wait in the queue</span></div>
                <div><b>{decided}</b><span>decided by you</span></div>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>The inbox's own event log: {mined.events} events across {mined.cases} work orders. p75 wait before each step, over all history:</p>
              <div className="bars">
                {mined.waits.map((w) => (
                  <div className="bar-row" key={w.a}>
                    <span className="lab">{w.a}{w.a === mined.bottleneck.a ? <small style={{ color: "var(--bad)" }}> · bottleneck</small> : null}</span>
                    <span className={"bar " + (w.a === mined.bottleneck.a ? "before" : "after")}><i style={{ width: `${(w.p75 / Math.max(...mined.waits.map((x) => x.p75), 1)) * 100}%` }} /></span>
                    <span className="val">{hrs(w.p75)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="small muted" style={{ marginTop: 8 }}>Bias check: p75 approval wait per site.</p>
              <div className="table-wrap"><table>
                <thead><tr><th>site</th><th className="num">approvals</th><th className="num">p75 wait</th></tr></thead>
                <tbody>{mined.bySite.map((b) => <tr key={b.site} className={b.p75 === Math.max(...mined.bySite.map((x) => x.p75)) ? "below" : ""}><td>{b.site}</td><td className="num">{b.n}</td><td className="num">{hrs(b.p75)}</td></tr>)}</tbody>
              </table></div>
              <p className="small muted" style={{ marginTop: 6 }}>Clearing old requests makes history's p75 go up, not down: their long waits enter the log, and the log doesn't forget. The queue's age is what drops. Fix the cause (auto-handling like-for-like spares within limits) and the next weeks' p75 falls. See it on ERP data in the <a href="fettle.html?try=metadc#lab">Process Lab</a>.</p>
            </div>
          </div>
        )}
        {tab === "rules" && (
          <div className="ib-process">
            <div><p className="small muted" style={{ marginTop: 8 }}>Rules from past reviews. Reject a request with a reason and it appears here, and the AI checks it on the next request.</p>
              <ul className="ib-rules">{t.rules.map((r, k) => <li key={k}><b>{r.text}</b><small>{r.source}{r.part ? ` · ${partOf(r.part).name}${r.site ? " at " + r.site : ""}` : ""}</small></li>)}</ul></div>
            <div><p className="small muted" style={{ marginTop: 8 }}>Examples: decisions a person approved after the AI suggested them.</p>
              {t.examples.length ? <ul className="ib-rules">{t.examples.map((x, k) => <li key={k}><b>{x}</b></li>)}</ul> : <p className="small muted">None yet. Approve an AI-safe request.</p>}</div>
          </div>
        )}
        {tab === "audit" && (
          <div className="table-wrap" style={{ marginTop: 8, maxHeight: 240, overflow: "auto" }}><table>
            <thead><tr><th>when (h)</th><th>work order</th><th>event</th><th>who</th><th>detail</th></tr></thead>
            <tbody>{[...t.log].reverse().slice(0, 40).map((e) => <tr key={e.id}><td className="num">{e.t.toFixed(1)}</td><td>{e.case}</td><td>{e.act}</td><td>{e.who}</td><td>{e.detail}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

