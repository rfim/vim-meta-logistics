import { useMemo, useReducer, useState } from "react";
import { PARTS, SITES, mineTower, partOf, seed, type Req, type Site, type Status, type Tower } from "../data/tower";

/* RMA & Work Orders. Benchmarks: MaintainX and UpKeep (maintenance work-order startups).
   Fettle's ideas made concrete: SLA targets come from mining the board's own log (each stage's historical p75),
   every card answers "where is it, who touched it last, what is it waiting for", pick is FIFO with lot
   traceability, and a mismatch opens an RMA (the rework loop) and a re-pick. SYNTHETIC data. */

const ME = "tech:you";
const COLS: { s: Status; label: string; next?: string; wait: string }[] = [
  { s: "awaiting approval", label: "Awaiting approval", next: "Approve (as lead)", wait: "a lead's approval" },
  { s: "approved", label: "Approved", next: "Pick FIFO", wait: "a warehouse pick" },
  { s: "picked", label: "Picked", next: "Ship", wait: "shipping" },
  { s: "shipped", label: "Shipped", next: "Receive", wait: "the dock" },
  { s: "received", label: "Received", next: "Install", wait: "a technician to install" },
  { s: "installed", label: "Installed", wait: "nothing: done" },
];
const NEXT: Partial<Record<Status, Status>> = { "awaiting approval": "approved", approved: "picked", picked: "shipped", shipped: "received", received: "installed" };
const ACT: Partial<Record<Status, string>> = { approved: "approved", picked: "picked", shipped: "shipped", received: "received", installed: "installed" };

type Rma = { id: string; wo: string; part: string; lot: string; reason: string; state: "open" | "shipped to vendor" | "credited" };
type S = Tower & { rmas: Rma[]; made: number };
type A = { type: "advance"; id: string } | { type: "mismatch"; id: string; reason: string } | { type: "rma"; id: string } | { type: "new" } | { type: "clock" } | { type: "reset" };

const init = (): S => ({ ...seed(), rmas: [], made: 0 });

function reduce(st: S, a: A): S {
  if (a.type === "reset") return init();
  if (a.type === "clock") return { ...st, now: +(st.now + 4).toFixed(2) };
  const now = +(st.now + 0.25).toFixed(2);
  const ev = (c: string, act: string, site: Site, detail = "", who = ME) => ({ id: st.nextEv, case: c, act, t: now, who, site, detail });
  if (a.type === "new") {
    const p = PARTS[st.made % PARTS.length], site = SITES[(st.made + 1) % 3], id = `WO-${3000 + st.made}`;
    const r: Req = { id, ticket: `T-${89000 + st.made}`, part: p.id, site, qty: 1, likeForLike: true, requester: ME, created: now, status: "awaiting approval" };
    return { ...st, now, made: st.made + 1, reqs: [r, ...st.reqs], nextEv: st.nextEv + 1, log: [...st.log, ev(id, "requested", site, `${p.name} × 1 for ticket ${r.ticket}`)] };
  }
  if (a.type === "rma") { // move the open RMA one step: ship to vendor, then credit
    const rm = st.rmas.find((x) => x.id === a.id)!;
    const state = rm.state === "open" ? "shipped to vendor" : "credited";
    const r = st.reqs.find((x) => x.id === rm.wo)!;
    return { ...st, now, nextEv: st.nextEv + 1, rmas: st.rmas.map((x) => (x.id === a.id ? { ...x, state } : x)), log: [...st.log, ev(rm.wo, state === "credited" ? "rma credited" : "rma shipped", r.site, `${rm.id} · ${rm.lot}`)] };
  }
  const r = st.reqs.find((x) => x.id === a.id)!;
  if (a.type === "mismatch") {
    const rid = `RMA-${500 + st.rmas.length}`;
    // the suspect lot goes on hold, so FIFO skips it on the re-pick
    const lots = st.lots.map((l) => (l.id === r.lot ? { ...l, status: "recalled" as const } : l));
    return {
      ...st, now, nextEv: st.nextEv + 1, lots,
      rmas: [...st.rmas, { id: rid, wo: r.id, part: r.part, lot: r.lot || "unknown lot", reason: a.reason, state: "open" }],
      reqs: st.reqs.map((x) => (x.id === r.id ? { ...x, status: "approved", lot: undefined } : x)), // back to pick: the rework loop
      log: [...st.log, ev(r.id, "rma opened", r.site, `${rid}: ${a.reason} · lot ${r.lot} on hold`)],
    };
  }
  const to = NEXT[r.status]!;
  let lots = st.lots, detail = "", lotTaken = r.lot;
  if (to === "picked") { // FIFO: oldest available lot first, recorded on the work order
    lots = st.lots.map((l) => ({ ...l }));
    const lot = lots.filter((l) => l.part === r.part && l.site === r.site && l.status === "available" && l.qty >= r.qty).sort((x, y) => x.received - y.received)[0];
    if (lot) { lot.qty -= r.qty; lotTaken = lot.id; detail = `FIFO: ${lot.id} (oldest available)`; } else detail = "no lot available";
  }
  if (to === "installed") detail = `installed in srv-${String(400 + (parseInt(r.id.slice(-3)) % 90)).padStart(4, "0")} · lot ${r.lot || "?"}`;
  const who = to === "approved" ? `lead:${r.site.toLowerCase()}` : to === "picked" || to === "shipped" ? "wms" : to === "received" ? "dock" : ME;
  return { ...st, now, lots, nextEv: st.nextEv + 1, reqs: st.reqs.map((x) => (x.id === r.id ? { ...x, status: to, lot: lotTaken } : x)), log: [...st.log, ev(r.id, ACT[to]!, r.site, detail, who)] };
}

const hrs = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

export function WorkOrders() {
  const [st, dispatch] = useReducer(reduce, undefined, init);
  const [site, setSite] = useState<Site | "all">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [reason, setReason] = useState("Wrong form factor: part does not fit the sled");
  const mined = useMemo(() => mineTower(st.log), [st.log]);

  // SLA per stage = historical p75 of the wait to leave that stage (mined from the board's own log)
  const sla = useMemo(() => {
    const p = (a: string) => mined.waits.find((w) => w.a === a)?.p75 || 4;
    return { "awaiting approval": p("approved"), approved: p("picked"), picked: p("shipped"), shipped: 16, received: p("installed"), installed: Infinity } as Record<string, number>;
  }, [mined]);
  const last = useMemo(() => { const m = new Map<string, { t: number; who: string; act: string }>(); for (const e of st.log) m.set(e.case, { t: e.t, who: e.who, act: e.act }); return m; }, [st.log]);
  const open = st.reqs.filter((r) => r.status !== "rejected" && (site === "all" || r.site === site));
  const inStage = (r: Req) => st.now - (last.get(r.id)?.t ?? r.created);
  const breaches = open.filter((r) => r.status !== "installed" && inStage(r) > sla[r.status]).length;
  const cur = st.reqs.find((r) => r.id === sel);
  const reworkRate = (() => { const cases = new Set(st.log.map((e) => e.case)).size; const rma = new Set(st.log.filter((e) => e.act === "rma opened").map((e) => e.case)).size; return cases ? rma / cases : 0; })();

  return (
    <div className="inbox wo">
      <div className="ib-top">
        <div><b className="ib-title">Work orders</b><span className="ib-sub">signed in as <code>{ME}</code> · technician · synthetic data · clock {st.now.toFixed(1)} h</span></div>
        <div className="row">
          <div className="seg" role="group" aria-label="Filter by site">
            {(["all", ...SITES] as const).map((x) => <button key={x} aria-pressed={site === x} onClick={() => setSite(x)}>{x === "all" ? "All sites" : x}</button>)}
          </div>
          <button className="btn btn-primary ib-mini" onClick={() => dispatch({ type: "new" })}>+ Work order</button>
          <button className="btn btn-ghost ib-mini" onClick={() => dispatch({ type: "clock" })} title="Move the clock forward to watch SLAs">⏩ +4 h</button>
          <button className="btn btn-ghost ib-mini" onClick={() => { dispatch({ type: "reset" }); setSel(null); }}>Reset demo</button>
        </div>
      </div>

      <div className="wo-kpis">
        <div><b>{open.filter((r) => r.status !== "installed").length}</b><span>open work orders</span></div>
        <div><b className={breaches ? "bad" : "good"}>{breaches}</b><span>past their mined SLA</span></div>
        <div><b>{(reworkRate * 100).toFixed(0)}%</b><span>rework (RMA) rate</span></div>
        <div><b>{st.rmas.filter((x) => x.state !== "credited").length}</b><span>RMAs open with vendors</span></div>
        <div><b>{hrs(mined.bottleneck?.p75 || 0)}</b><span>bottleneck p75: {mined.bottleneck?.a}</span></div>
      </div>

      <div className="board wo-board" role="region" aria-label="Work-order board" tabIndex={0}>
        {COLS.map((c) => {
          const cards = open.filter((r) => r.status === c.s);
          return (
            <div className="col" key={c.s}>
              <h4>{c.label}<span>{cards.length}</span></h4>
              <p className="wo-sla">{c.s === "installed" ? "closed" : <>SLA {hrs(sla[c.s])}<small>{c.s === "shipped" ? " = carrier target (transit)" : " = mined p75"}</small></>}</p>
              {cards.slice(0, 8).map((r) => {
                const age = inStage(r), late = c.s !== "installed" && age > sla[c.s], p = partOf(r.part);
                return (
                  <div key={r.id} className={"ticket wo-card" + (late ? " late" : "") + (sel === r.id ? " on" : "")}>
                    <button className="wo-open" onClick={() => setSel(r.id)} aria-label={`Open ${r.id}`}>
                      <b>{r.id}</b><span>{p.name} × {r.qty} · {r.site}</span>
                      {c.s !== "installed" && <span className={"wo-age" + (late ? " late" : "")}>⏱ {hrs(age)}{late ? " · over SLA" : ""}</span>}
                      {r.lot && <span className="wo-lot">lot {r.lot}</span>}
                    </button>
                    <div className="wo-acts">
                      {c.next && <button className="btn btn-primary ib-mini" onClick={() => dispatch({ type: "advance", id: r.id })}>{c.next}</button>}
                      {c.s === "received" && <button className="btn btn-ghost ib-mini" onClick={() => { dispatch({ type: "mismatch", id: r.id, reason }); setSel(r.id); }}>Mismatch → RMA</button>}
                    </div>
                  </div>
                );
              })}
              {cards.length > 8 && <p className="small muted">+{cards.length - 8} more</p>}
            </div>
          );
        })}
        <div className="col wo-rma">
          <h4>RMA · vendor returns<span>{st.rmas.length}</span></h4>
          <p className="wo-sla">the rework loop</p>
          {st.rmas.length === 0 && <p className="small muted">Mark a received part as a mismatch to open one.</p>}
          {st.rmas.map((x) => (
            <div key={x.id} className={"ticket wo-card" + (x.state === "credited" ? " done" : "")}>
              <button className="wo-open" onClick={() => setSel(x.wo)}><b>{x.id}</b><span>{partOf(x.part).name} · {x.wo}</span><span className="wo-lot">{x.lot} · {x.state}</span></button>
              {x.state !== "credited" && <div className="wo-acts"><button className="btn btn-ghost ib-mini" onClick={() => dispatch({ type: "rma", id: x.id })}>{x.state === "open" ? "Ship to vendor" : "Mark credited"}</button></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="wo-bottom">
        <section className="wo-detail" aria-live="polite">
          {!cur ? <p className="small muted">Select a card to see where it is, who touched it last, and what it's waiting for.</p> : (() => {
            const l = last.get(cur.id), col = COLS.find((c) => c.s === cur.status);
            const evs = st.log.filter((e) => e.case === cur.id);
            return (<>
              <div className="wo-three">
                <div><span className="ib-k">Where it is</span><b>{col?.label || cur.status}</b><small>{cur.site}{cur.lot ? ` · lot ${cur.lot}` : ""}</small></div>
                <div><span className="ib-k">Who touched it last</span><b>{l?.who}</b><small>{l?.act}, {hrs(st.now - (l?.t ?? st.now))} ago</small></div>
                <div><span className="ib-k">What it's waiting for</span><b>{col?.wait}</b><small>{cur.status !== "installed" ? `SLA ${hrs(sla[cur.status])}` : "closed"}</small></div>
              </div>
              <ol className="wo-timeline">{evs.map((e) => <li key={e.id}><span>{e.t.toFixed(1)} h</span><b>{e.act}</b><em>{e.who}</em>{e.detail && <small>{e.detail}</small>}</li>)}</ol>
              {cur.status === "received" && <label className="f mt">RMA reason (used if you mark a mismatch)<input className="ib-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
            </>);
          })()}
        </section>
        <section className="wo-process">
          <span className="ib-k">Process, mined from this board ({mined.events} events, {mined.cases} work orders)</span>
          <div className="wo-flow">
            {["requested", "approved", "picked", "shipped", "received", "installed"].map((a, k) => {
              const w = mined.waits.find((x) => x.a === a);
              return (
                <div key={a} className={"wo-stage" + (a === mined.bottleneck?.a ? " hot" : "")}>
                  {k > 0 && <i aria-hidden="true">→</i>}
                  <b>{a}</b><small>{w ? `p75 ${hrs(w.p75)}` : a === "received" ? "transit" : "start"}</small>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            Rework: <b>{(reworkRate * 100).toFixed(0)}%</b> of work orders went through an RMA and a re-pick ({mined.edges.find((e) => e.k === "rma opened → picked")?.n || 0} rma → re-pick transitions). The red stage is where work waits longest. SLAs are not guesses: each is that stage's historical p75, re-mined after every action.
          </p>
        </section>
      </div>
    </div>
  );
}
