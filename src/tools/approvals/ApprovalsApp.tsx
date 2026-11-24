import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DB_NAME, SCHEMA, openDB, resetDB, type DB } from "./db";
import * as api from "./api";
import type { Ev, Lot, Req, User } from "./api";

/* Back-office 1, built as a real internal tool, without Fettle.
   Benchmarks: Retool / Airplane-style internal tools, Linear's inbox. Data is SYNTHETIC. */

type View = "queue" | "mine" | "all" | "new" | "stock" | "audit" | "data";
type Toast = { id: number; ok: boolean; text: string };

const hrs = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} d`);
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const ROLE: Record<api.Role, string> = { technician: "Technician", approver: "Site lead (approver)", senior_approver: "Logistics manager (senior approver)" };
const saved = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function StatusPill({ s }: { s: api.Status }) { return <span className={"sa-pill s-" + s.replace(" ", "-")}>{s}</span>; }
function Age({ r }: { r: Req }) {
  const open = r.status === "awaiting approval" || r.status === "info requested";
  if (!open) return <span className="muted">–</span>;
  return <span className={"sa-age" + (r.age_h > api.SLA_H ? " late" : r.age_h > api.SLA_H * 0.75 ? " soon" : "")}>{hrs(r.age_h)}</span>;
}

export function ApprovalsApp() {
  const [boot, setBoot] = useState<{ db: DB; persisted: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [parts, setParts] = useState<{ id: string; name: string; approval_limit: number }[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [meId, setMeId] = useState(() => saved("sa-user") || "cy");
  const [view, setView] = useState<View>(() => (saved("sa-view") as View) || "queue");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const db = boot?.db;
  const me = users.find((u) => u.id === meId);

  const toast = useCallback((ok: boolean, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, ok, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 3200 : 6000);
  }, []);

  useEffect(() => {
    openDB().then(async (b) => {
      setUsers(await api.users(b.db)); setParts(await api.parts(b.db)); setSites(await api.sites(b.db)); setBoot(b);
    }).catch((e) => setErr(String(e?.message || e)));
  }, []);
  const refresh = useCallback(async () => { if (db) setReqs(await api.listRequests(db)); setTick((t) => t + 1); }, [db]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { save("sa-user", meId); }, [meId]);
  useEffect(() => { save("sa-view", view); }, [view]);

  // the view each role lands on
  const views = useMemo(() => {
    if (!me) return [] as [View, string, number?][];
    const queue = reqs.filter((r) => r.status === "awaiting approval" && api.inScope(me, r));
    const mine = reqs.filter((r) => r.requester_id === me.id);
    const out: [View, string, number?][] = [];
    if (me.role !== "technician") out.push(["queue", "Approval queue", queue.length]);
    out.push(["mine", "My requests", mine.filter((r) => r.status === "info requested").length || undefined], ["new", "New request"], ["all", "All requests"], ["stock", "Stock"], ["audit", "Audit log"], ["data", "Data (SQL)"]);
    return out;
  }, [me, reqs]);
  useEffect(() => { if (me && view === "queue" && me.role === "technician") setView("mine"); }, [me, view]);

  const run = async (label: string, f: () => Promise<unknown>) => {
    setBusy(true);
    try { await f(); toast(true, label); await refresh(); return true; }
    catch (e) { toast(false, String((e as Error).message || e)); await refresh(); return false; }
    finally { setBusy(false); }
  };

  if (err) return <div className="sa-boot"><b>Couldn't start the database.</b><p className="small muted">{err}</p><p className="small">PGlite (Postgres in WebAssembly) loads from jsDelivr. Check the connection and reload.</p></div>;
  if (!boot || !me) return <div className="sa-boot"><span className="sa-spin" aria-hidden="true" /><b>Starting Postgres in your browser…</b><p className="small muted">PGlite, about 3 MB, loaded once and cached.</p></div>;

  const current = reqs.find((r) => r.id === sel) || null;

  return (
    <div className="sa">
      <aside className="sa-nav" aria-label="Tool navigation">
        <div className="sa-brand"><b>Spares Approvals</b><span>internal tool · synthetic data</span></div>
        <label className="sa-user">
          <span>Signed in as</span>
          <select value={meId} onChange={(e) => { setMeId(e.target.value); setSel(null); }}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <small>{ROLE[me.role]}{me.site_id ? ` · ${me.site_id}` : " · all sites"}</small>
        </label>
        <nav>
          {views.map(([v, label, n]) => (
            <button key={v} aria-current={view === v ? "page" : undefined} onClick={() => { setView(v); setSel(null); }}>
              {label}{n ? <b>{n}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sa-nav-foot">
          <span className={"sa-dot " + (boot.persisted ? "ok" : "warn")} />
          <small>{boot.persisted ? <>Saved in this browser (<code>{DB_NAME.replace("idb://", "")}</code>). Reload and it's still here.</> : "Memory only: this browser blocks storage."}</small>
          <button className="btn btn-ghost sa-sm" disabled={busy} onClick={() => { if (confirm("Drop every table and seed the demo data again?")) run("Data reset", async () => { await resetDB(boot.db); setSel(null); }); }}>Reset data</button>
        </div>
      </aside>

      <main className="sa-main" aria-busy={busy}>
        {view === "queue" && <Queue me={me} reqs={reqs} sites={sites} sel={sel} setSel={setSel} busy={busy}
          bulk={(ids) => run(`Approved ${ids.length}`, async () => { for (const id of ids) await api.approve(boot.db, me, id, "bulk approval"); })} />}
        {view === "mine" && <ListView title="My requests" sub="Everything you have raised. Answer questions from approvers here." rows={reqs.filter((r) => r.requester_id === me.id)} sel={sel} setSel={setSel} empty="You haven't raised a request yet." onNew={() => setView("new")} />}
        {view === "all" && <ListView title="All requests" sub="Every site, every status. Export what you see as CSV." rows={reqs} sel={sel} setSel={setSel} filters empty="No requests." />}
        {view === "new" && <NewRequest me={me} parts={parts} sites={sites} busy={busy}
          submit={async (n) => { let id = ""; const ok = await run("Request created", async () => { id = await api.create(boot.db, me, n); }); if (ok) { setView("mine"); setSel(id); } return ok; }} />}
        {view === "stock" && <Stock db={boot.db} tick={tick} />}
        {view === "audit" && <Audit db={boot.db} tick={tick} toast={toast} />}
        {view === "data" && <Data db={boot.db} />}
      </main>

      {current && (
        <Detail key={current.id + current.status} db={boot.db} me={me} r={current} busy={busy} close={() => setSel(null)}
          act={(label, f) => run(label, f)} />
      )}

      <div className="sa-toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"sa-toast " + (t.ok ? "ok" : "bad")}>{t.ok ? "✓ " : "✕ "}{t.text}</div>)}
      </div>
    </div>
  );
}

/* ---------------- approval queue ---------------- */
function Queue({ me, reqs, sites, sel, setSel, bulk, busy }: { me: User; reqs: Req[]; sites: string[]; sel: string | null; setSel: (s: string | null) => void; bulk: (ids: string[]) => Promise<boolean>; busy: boolean }) {
  const [q, setQ] = useState(""), [site, setSite] = useState("all"), [picked, setPicked] = useState<Set<string>>(new Set()), [confirming, setConfirming] = useState(false);
  const rows = reqs.filter((r) => r.status === "awaiting approval" && api.inScope(me, r) && (site === "all" || r.site_id === site) && (!q || `${r.id} ${r.ticket} ${r.part} ${r.requester}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.age_h - a.age_h);
  const ready = (r: Req) => api.canApprove(api.policy(me, r));
  const chosen = rows.filter((r) => picked.has(r.id));
  const chosenReady = chosen.filter(ready);
  const late = rows.filter((r) => r.age_h > api.SLA_H).length;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section>
      <header className="sa-head">
        <div><h2>Approval queue</h2><p className="small muted">Oldest first. {me.role === "senior_approver" ? "You see every site, and can sign over-limit and non-like-for-like requests." : `Requests for ${me.site_id}.`}</p></div>
        <div className="sa-kpis">
          <div><b>{rows.length}</b><span>waiting</span></div>
          <div><b className={late ? "bad" : ""}>{late}</b><span>past {api.SLA_H} h SLA</span></div>
          <div><b>{rows.filter(ready).length}</b><span>pass policy</span></div>
        </div>
      </header>
      <div className="sa-bar">
        <input type="search" placeholder="Search ID, ticket, part, requester" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the queue" />
        {me.role === "senior_approver" && (
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site"><option value="all">All sites</option>{sites.map((s) => <option key={s}>{s}</option>)}</select>
        )}
        <span className="grow" />
        {confirming
          ? <span className="sa-confirm">Approve {chosenReady.length} as {me.name.split(" ")[0]}?{chosen.length > chosenReady.length ? ` ${chosen.length - chosenReady.length} fail policy and are skipped.` : ""}
              <button className="btn btn-primary sa-sm" disabled={busy || !chosenReady.length} onClick={async () => { await bulk(chosenReady.map((r) => r.id)); setPicked(new Set()); setConfirming(false); }}>Approve</button>
              <button className="btn btn-ghost sa-sm" onClick={() => setConfirming(false)}>Cancel</button></span>
          : <button className="btn btn-ghost sa-sm" disabled={!chosen.length} onClick={() => setConfirming(true)}>Approve selected ({chosen.length})</button>}
      </div>
      {rows.length === 0 ? <p className="sa-empty">Queue clear. Nothing is waiting for you.</p> : (
        <div className="table-wrap sa-table"><table>
          <thead><tr><th className="cb"><input type="checkbox" aria-label="Select all" checked={rows.length > 0 && rows.every((r) => picked.has(r.id))} onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th><th>Request</th><th>Part</th><th className="num">Qty</th><th>Site</th><th>Requester</th><th className="num">Waiting</th><th>Policy</th></tr></thead>
          <tbody>{rows.map((r) => {
            const bad = api.policy(me, r).filter((c) => !c.ok);
            return (
              <tr key={r.id} className={sel === r.id ? "on" : ""} onClick={() => setSel(r.id)}>
                <td className="cb" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.id}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><button className="sa-link" onClick={(e) => { e.stopPropagation(); setSel(r.id); }}>{r.id}</button><small>{r.ticket}</small></td>
                <td>{r.part}</td><td className="num">{r.qty}</td><td>{r.site_id}</td><td>{r.requester.split(" (")[0]}</td>
                <td className="num"><Age r={r} /></td>
                <td>{bad.length ? <span className="sa-flag hold" title={bad.map((c) => c.text).join("\n")}>{bad[0].text.split(":").pop()!.trim()}</span> : <span className="sa-flag ok">ready</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </section>
  );
}

/* ---------------- list (mine / all) ---------------- */
function ListView({ title, sub, rows, sel, setSel, filters, empty, onNew }: { title: string; sub: string; rows: Req[]; sel: string | null; setSel: (s: string) => void; filters?: boolean; empty: string; onNew?: () => void }) {
  const [st, setSt] = useState("open"), [q, setQ] = useState("");
  const open = (r: Req) => r.status === "awaiting approval" || r.status === "info requested";
  const shown = rows.filter((r) => (st === "all" || (st === "open" ? open(r) : r.status === st)) && (!q || `${r.id} ${r.ticket} ${r.part} ${r.requester} ${r.site_id}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (+(b.status === "info requested") - +(a.status === "info requested")) || b.created_at.localeCompare(a.created_at));
  return (
    <section>
      <header className="sa-head"><div><h2>{title}</h2><p className="small muted">{sub}</p></div>{onNew && <button className="btn btn-primary sa-sm" onClick={onNew}>New request</button>}</header>
      <div className="sa-bar">
        <div className="seg" role="group" aria-label="Status">
          {["open", "approved", "rejected", "cancelled", "all"].map((s) => <button key={s} aria-pressed={st === s} onClick={() => setSt(s)}>{s}</button>)}
        </div>
        {filters && <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requests" />}
        <span className="grow" />
        {filters && <button className="btn btn-ghost sa-sm" disabled={!shown.length} onClick={() => download(`requests-${new Date().toISOString().slice(0, 10)}.csv`, api.toCSV(shown.map(({ age_h, ...r }) => ({ ...r, age_h: +age_h.toFixed(2) }))))}>Export CSV</button>}
      </div>
      {shown.length === 0 ? <p className="sa-empty">{rows.length ? "Nothing matches." : empty}</p> : (
        <div className="table-wrap sa-table"><table>
          <thead><tr><th>Request</th><th>Part</th><th className="num">Qty</th><th>Site</th>{filters && <th>Requester</th>}<th>Status</th><th className="num">Waiting</th><th>Created</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className={sel === r.id ? "on" : ""} onClick={() => setSel(r.id)}>
              <td><button className="sa-link" onClick={(e) => { e.stopPropagation(); setSel(r.id); }}>{r.id}</button><small>{r.ticket}</small></td>
              <td>{r.part}</td><td className="num">{r.qty}</td><td>{r.site_id}</td>{filters && <td>{r.requester.split(" (")[0]}</td>}
              <td><StatusPill s={r.status} /></td><td className="num"><Age r={r} /></td><td className="muted">{when(r.created_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

/* ---------------- request detail ---------------- */
function Detail({ db, me, r, busy, close, act }: { db: DB; me: User; r: Req; busy: boolean; close: () => void; act: (label: string, f: () => Promise<unknown>) => Promise<boolean> }) {
  const [evs, setEvs] = useState<Ev[]>([]), [lots, setLots] = useState<Lot[] | null>(null), [text, setText] = useState("");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { api.history(db, r.id).then(setEvs); api.fifo(db, r.part_id, r.site_id).then(setLots); }, [db, r]);
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const checks = api.policy(me, r);
  const approver = me.role !== "technician" && api.inScope(me, r) && r.status === "awaiting approval";
  const mine = r.requester_id === me.id;
  let left = r.qty;
  const plan = (lots || []).map((l) => { const take = Math.max(0, Math.min(l.qty, left)); left -= take; return { ...l, take }; }).filter((l) => l.take > 0);

  return (
    <aside className="sa-detail" ref={ref} tabIndex={-1} aria-label={`Request ${r.id}`}>
      <div className="sa-dhead">
        <div><span className="eyebrow" style={{ margin: 0 }}>{r.id} · ticket {r.ticket}</span><h3>{r.part} × {r.qty} <small>for {r.site_id}</small></h3></div>
        <button className="icon-btn" onClick={close} aria-label="Close">✕</button>
      </div>
      <div className="sa-meta">
        <StatusPill s={r.status} />
        <span>by <b>{r.requester.split(" (")[0]}</b></span>
        <span>{when(r.created_at)}</span>
        {(r.status === "awaiting approval" || r.status === "info requested") && <span>waiting <Age r={r} /></span>}
      </div>
      <dl className="sa-dl">
        <dt>Like-for-like</dt><dd>{r.like_for_like ? `Yes · failed serial ${r.failed_serial}` : "No"}</dd>
        {r.note && <><dt>Note</dt><dd>{r.note}</dd></>}
        <dt>Value</dt><dd>£{(r.qty * r.unit_cost_gbp).toLocaleString("en-GB")} ({r.qty} × £{r.unit_cost_gbp})</dd>
        {r.decided_by && <><dt>Decided</dt><dd>{r.status} by {r.decider?.split(" (")[0]} · {when(r.decided_at)}{r.decision_note ? ` · “${r.decision_note}”` : ""}</dd></>}
        {r.reserved && <><dt>Reserved</dt><dd><code>{r.reserved}</code></dd></>}
      </dl>

      {approver && (<>
        <h4>Policy</h4>
        <ul className="sa-checks">{checks.map((c, k) => <li key={k} className={c.info ? "info" : c.ok ? "yes" : "no"}><i aria-hidden="true">{c.info ? "·" : c.ok ? "✓" : "✕"}</i>{c.text}</li>)}</ul>
        <h4>Would reserve (FIFO, oldest lot first)</h4>
        {!lots ? <p className="small muted">Checking lots…</p> : plan.length ? <p className="small">{plan.map((l) => `${l.id} × ${l.take} (received ${new Date(l.received_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })})`).join(" → ")}{left > 0 ? <b className="bad"> · short by {left}</b> : null}</p> : <p className="small bad">No stock at {r.site_id}.</p>}
        <label className="sa-field"><span>Comment <small className="muted">(required to reject or ask; optional to approve)</small></span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Use the DC-B spare instead" /></label>
        <div className="row">
          <button className="btn btn-primary sa-sm" disabled={busy || !api.canApprove(checks)} onClick={() => act(`Approved ${r.id}`, () => api.approve(db, me, r.id, text.trim()))}>Approve</button>
          <button className="btn btn-ghost sa-sm" disabled={busy || text.trim().length < 8} onClick={() => act(`Rejected ${r.id}`, () => api.reject(db, me, r.id, text))}>Reject</button>
          <button className="btn btn-ghost sa-sm" disabled={busy || text.trim().length < 5} onClick={() => act(`Asked ${r.requester.split(" (")[0]}`, () => api.askInfo(db, me, r.id, text))}>Ask requester</button>
        </div>
        {!api.canApprove(checks) && <p className="small muted" style={{ margin: "6px 0 0" }}>Approve is off: {checks.filter((c) => !c.ok).map((c) => c.text.toLowerCase()).join("; ")}.</p>}
      </>)}

      {mine && r.status === "info requested" && (<>
        <h4>Answer the approver</h4>
        <label className="sa-field"><span className="sr">Answer</span><textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Rack 14, slot 3. Serial photo attached to the ticket." /></label>
        <div className="row"><button className="btn btn-primary sa-sm" disabled={busy || text.trim().length < 2} onClick={() => act("Answer sent, back in the queue", () => api.reply(db, me, r.id, text))}>Send and resubmit</button></div>
      </>)}
      {mine && (r.status === "awaiting approval" || r.status === "info requested") && (
        <p className="small" style={{ marginTop: 10 }}><button className="sa-link danger" disabled={busy} onClick={() => act(`Cancelled ${r.id}`, () => api.cancel(db, me, r.id))}>Cancel this request</button></p>
      )}
      {!approver && !mine && r.status === "awaiting approval" && <p className="small muted">You can't act on this one: {checks.filter((c) => !c.ok).map((c) => c.text.toLowerCase())[0] || "view only"}. Switch user to try another role.</p>}

      <h4>History</h4>
      <ol className="sa-hist">{evs.map((e) => <li key={e.id}><b>{e.action}</b> · {e.actor.split(" (")[0]} <span className="muted">· {when(e.at)}</span>{e.detail ? <p>{e.detail}</p> : null}</li>)}</ol>
    </aside>
  );
}

/* ---------------- new request ---------------- */
function NewRequest({ me, parts, sites, busy, submit }: { me: User; parts: { id: string; name: string; approval_limit: number }[]; sites: string[]; busy: boolean; submit: (n: api.NewReq) => Promise<boolean> }) {
  const blank = (): api.NewReq => ({ ticket: "", part_id: "", site_id: me.site_id || sites[0], qty: 1, like_for_like: true, failed_serial: "", note: "" });
  const [n, setN] = useState<api.NewReq>(blank), [tried, setTried] = useState(false);
  useEffect(() => { setN(blank()); setTried(false); }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const errs = api.validate(n), part = parts.find((p) => p.id === n.part_id);
  const set = <K extends keyof api.NewReq>(k: K, v: api.NewReq[K]) => setN((x) => ({ ...x, [k]: v }));
  const E = ({ k }: { k: string }) => (tried && errs[k] ? <small className="bad" id={`e-${k}`}>{errs[k]}</small> : null);
  return (
    <section>
      <header className="sa-head"><div><h2>New spares request</h2><p className="small muted">Raised against a break-fix ticket. Approvers for {n.site_id} see it straight away.</p></div></header>
      <form className="sa-form" noValidate onSubmit={async (e) => { e.preventDefault(); setTried(true); if (Object.keys(errs).length) return; if (await submit(n)) { setN(blank()); setTried(false); } }}>
        <label className="sa-field"><span>Ticket</span><input value={n.ticket} onChange={(e) => set("ticket", e.target.value.toUpperCase())} placeholder="T-88231" aria-invalid={tried && !!errs.ticket} aria-describedby="e-ticket" /><E k="ticket" /></label>
        <label className="sa-field"><span>Site</span>
          <select value={n.site_id} onChange={(e) => set("site_id", e.target.value)} disabled={me.role === "technician"}>{sites.map((s) => <option key={s}>{s}</option>)}</select>
          {me.role === "technician" && <small className="muted">Technicians request for their own site.</small>}</label>
        <label className="sa-field"><span>Part</span>
          <select value={n.part_id} onChange={(e) => set("part_id", e.target.value)} aria-invalid={tried && !!errs.part_id}><option value="">Choose…</option>{parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><E k="part_id" /></label>
        <label className="sa-field"><span>Quantity</span><input type="number" min={1} max={50} value={n.qty} onChange={(e) => set("qty", +e.target.value)} aria-invalid={tried && !!errs.qty} />
          {part && n.qty > part.approval_limit ? <small className="warn">Over the limit of {part.approval_limit}: a senior approver must sign.</small> : <E k="qty" />}</label>
        <label className="sa-check"><input type="checkbox" checked={n.like_for_like} onChange={(e) => set("like_for_like", e.target.checked)} /> Like-for-like replacement of a failed part</label>
        {n.like_for_like
          ? <label className="sa-field"><span>Failed part serial</span><input value={n.failed_serial} onChange={(e) => set("failed_serial", e.target.value)} placeholder="SN-A123456" aria-invalid={tried && !!errs.failed_serial} /><E k="failed_serial" /></label>
          : <label className="sa-field"><span>Why not like-for-like?</span><textarea rows={2} value={n.note} onChange={(e) => set("note", e.target.value)} aria-invalid={tried && !!errs.note} /><small className="warn">Not like-for-like: a senior approver must sign.</small><E k="note" /></label>}
        {n.like_for_like && <label className="sa-field"><span>Note <small className="muted">(optional)</small></span><input value={n.note} onChange={(e) => set("note", e.target.value)} /></label>}
        <div className="row"><button className="btn btn-primary sa-sm" disabled={busy}>Submit request</button><button type="button" className="btn btn-ghost sa-sm" onClick={() => { setN(blank()); setTried(false); }}>Clear</button></div>
      </form>
    </section>
  );
}

/* ---------------- stock ---------------- */
function Stock({ db, tick }: { db: DB; tick: number }) {
  const [rows, setRows] = useState<{ part_id: string; part: string; site_id: string; on_hand: number }[]>([]);
  useEffect(() => { api.stockTable(db).then(setRows); }, [db, tick]);
  const siteIds = [...new Set(rows.map((r) => r.site_id))], partIds = [...new Set(rows.map((r) => r.part_id))];
  const cell = (p: string, s: string) => rows.find((r) => r.part_id === p && r.site_id === s)?.on_hand ?? 0;
  return (
    <section>
      <header className="sa-head"><div><h2>Stock on hand</h2><p className="small muted">From the <code>stock</code> view over lots. Approving a request reserves from the oldest lot first, in the same transaction.</p></div></header>
      <div className="table-wrap sa-table"><table>
        <thead><tr><th>Part</th>{siteIds.map((s) => <th key={s} className="num">{s}</th>)}</tr></thead>
        <tbody>{partIds.map((p) => <tr key={p}><td>{rows.find((r) => r.part_id === p)?.part}</td>{siteIds.map((s) => { const v = cell(p, s); return <td key={s} className={"num" + (v <= 2 ? " bad" : "")}>{v}</td>; })}</tr>)}</tbody>
      </table></div>
      <p className="small muted">Red: two or fewer on hand.</p>
    </section>
  );
}

/* ---------------- audit ---------------- */
function Audit({ db, tick, toast }: { db: DB; tick: number; toast: (ok: boolean, t: string) => void }) {
  const [rows, setRows] = useState<Ev[]>([]);
  useEffect(() => { api.auditLog(db).then(setRows); }, [db, tick]);
  return (
    <section>
      <header className="sa-head"><div><h2>Audit log</h2><p className="small muted">Every change writes one event in the same transaction. A trigger makes the table append-only.</p></div>
        <div className="row">
          <button className="btn btn-ghost sa-sm" onClick={async () => toast(false, "Postgres said: " + (await api.tryTamper(db)))}>Try deleting an event</button>
          <button className="btn btn-ghost sa-sm" onClick={() => download("audit-log.csv", api.toCSV(rows))}>Export CSV</button>
        </div></header>
      <div className="table-wrap sa-table"><table>
        <thead><tr><th>When</th><th>Request</th><th>Action</th><th>Who</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((e) => <tr key={e.id}><td className="muted">{when(e.at)}</td><td>{e.request_id}</td><td>{e.action}</td><td>{e.actor.split(" (")[0]}</td><td>{e.detail}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

/* ---------------- data (read-only SQL) ---------------- */
const SAMPLES: [string, string][] = [
  ["Approval time by site", `select r.site_id,
       count(*) decided,
       round(percentile_cont(0.5) within group (order by extract(epoch from e.at - r.created_at) / 3600)::numeric, 1) p50_hours,
       round(percentile_cont(0.9) within group (order by extract(epoch from e.at - r.created_at) / 3600)::numeric, 1) p90_hours
from request r join event e on e.request_id = r.id and e.action in ('approved', 'rejected')
group by r.site_id order by r.site_id`],
  ["Open by status and site", `select status, site_id, count(*) from request group by 1, 2 order by 1, 2`],
  ["Past SLA right now", `select id, part_id, site_id, round(extract(epoch from now() - created_at) / 3600) hours_waiting
from request where status = 'awaiting approval' and created_at < now() - interval '24 hours' order by created_at`],
  ["Who decided what", `select u.name, e.action, count(*) from event e join app_user u on u.id = e.actor_id
where e.action in ('approved', 'rejected', 'info requested') group by 1, 2 order by 1, 2`],
];
function Data({ db }: { db: DB }) {
  const [sql, setSql] = useState(SAMPLES[0][1]), [res, setRes] = useState<{ fields: { name: string }[]; rows: Record<string, unknown>[] } | null>(null), [err, setErr] = useState(""), [schema, setSchema] = useState(false);
  const go = async (q = sql) => { setErr(""); try { setRes(await api.readOnly(db, q)); } catch (e) { setRes(null); setErr(String((e as Error).message)); } };
  useEffect(() => { go(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section>
      <header className="sa-head"><div><h2>Data</h2><p className="small muted">The tool's own Postgres. Queries run in a read-only transaction that is rolled back, so nothing here can change the data.</p></div>
        <button className="btn btn-ghost sa-sm" onClick={() => setSchema(!schema)}>{schema ? "Hide" : "Show"} schema</button></header>
      {schema && <pre className="sa-pre">{SCHEMA.trim()}</pre>}
      <div className="row" style={{ marginBottom: 8 }}>{SAMPLES.map(([t, q]) => <button key={t} className="sa-chip" onClick={() => { setSql(q); go(q); }}>{t}</button>)}</div>
      <textarea className="sa-sql" rows={6} value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} aria-label="SQL"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } }} />
      <div className="row" style={{ margin: "8px 0" }}><button className="btn btn-primary sa-sm" onClick={() => go()}>Run</button><small className="muted">⌘/Ctrl + Enter</small></div>
      {err && <p className="sa-err">{err}</p>}
      {res && (res.rows.length ? <div className="table-wrap sa-table"><table>
        <thead><tr>{res.fields.map((f) => <th key={f.name}>{f.name}</th>)}</tr></thead>
        <tbody>{res.rows.map((r, k) => <tr key={k}>{res.fields.map((f) => { const v = r[f.name]; return <td key={f.name}>{v instanceof Date ? when(v.toISOString()) : v === null ? <span className="muted">null</span> : String(v)}</td>; })}</tr>)}</tbody>
      </table></div> : <p className="sa-empty">No rows.</p>)}
    </section>
  );
}
