import { useMemo, useReducer, useState } from "react";

/* Asset source of truth. Benchmarks: NetBox (NetBox Labs) and Device42.
   The data-engineering side made concrete: a DC → hall → rack → server → component hierarchy; components
   carry serial and lot (FIFO); every change is an SCD2 version with lineage (source LSN, load time, batch);
   contracts send bad rows to quarantine with a reason instead of blocking anything; and restore time is mined
   from the asset events. SYNTHETIC data. */

type Site = "DC-A" | "DC-B" | "DC-C";
const SITES: Site[] = ["DC-A", "DC-B", "DC-C"];
type CStatus = "ok" | "failed";
type Comp = { id: string; slot: string; part: string; serial: string; lot: string; installed: number; status: CStatus };
type Server = { id: string; site: Site; hall: string; rack: string; u: number; comps: Comp[] };
type Version = { asset: string; ver: number; rack: string; status: string; from: number; to: number | null; lsn: number; loaded: number; batch: string; who: string };
type AEv = { t: number; asset: string; act: string; who: string; detail: string };
type Q = { id: string; asset: string; field: string; value: string; reason: string; at: number; state: "held" | "replayed" };
type S = { now: number; servers: Server[]; versions: Version[]; events: AEv[]; quarantine: Q[]; lots: Record<string, { id: string; qty: number }[]>; lsn: number; batch: number };

const PARTS = [{ slot: "SSD 0", part: "SSD 3.84 TB" }, { slot: "SSD 1", part: "SSD 3.84 TB" }, { slot: "DIMM A1", part: "DIMM 64 GB" }, { slot: "PSU 1", part: "PSU 2 kW" }];
const HALLS = ["Hall 1", "Hall 2"], RACKS = ["R01", "R02", "R03"];
const layout = (site: Site) => HALLS.flatMap((h) => RACKS.map((r) => `${site}/${h}/${r}`));
const ME = "tech:you";

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function seed(): S {
  const r = rng(23), servers: Server[] = [], versions: Version[] = [], events: AEv[] = [];
  let n = 400, lsn = 5_400_000;
  const lots: S["lots"] = {};
  for (const s of SITES) for (const p of ["SSD 3.84 TB", "DIMM 64 GB", "PSU 2 kW"]) lots[`${s}|${p}`] = [0, 1, 2].map((k) => ({ id: `L-${s.slice(-1)}-${p.slice(0, 3).toUpperCase()}-${710 + k}`, qty: 6 + Math.floor(r() * 8) }));
  for (const s of SITES) for (const h of HALLS) for (const rk of RACKS) for (let u = 0; u < 3; u++) {
    const id = `srv-${String(n++).padStart(4, "0")}`, rack = `${s}/${h}/${rk}`;
    const comps = PARTS.map((p, k) => ({ id: `${id}:${k}`, slot: p.slot, part: p.part, serial: `${p.part.slice(0, 3).toUpperCase()}${Math.floor(1e6 + r() * 9e6)}`, lot: lots[`${s}|${p.part}`][0].id, installed: Math.floor(r() * 200), status: "ok" as CStatus }));
    servers.push({ id, site: s, hall: h, rack, u: 10 + u * 4, comps });
    versions.push({ asset: id, ver: 1, rack, status: "healthy", from: 0, to: null, lsn: lsn++, loaded: 0.05, batch: "B-0001", who: "import" });
    // history so restore time can be mined: some past failures and restores
    if (r() < 0.45) {
      const tf = 20 + r() * 260, wait = r() < 0.35 ? 20 + r() * 40 : 2 + r() * 10;
      events.push({ t: +tf.toFixed(1), asset: id, act: "component failed", who: "monitor", detail: PARTS[Math.floor(r() * 4)].slot });
      events.push({ t: +(tf + wait).toFixed(1), asset: id, act: "restored", who: "tech:ana", detail: "spare installed" });
    }
  }
  // today: three servers are degraded and waiting for a spare
  const now = 336;
  for (const [i, slot, ago] of [[2, 0, 9], [17, 1, 31], [40, 3, 4]] as [number, number, number][]) {
    const sv = servers[i]; sv.comps[slot].status = "failed";
    events.push({ t: now - ago, asset: sv.id, act: "component failed", who: "monitor", detail: sv.comps[slot].slot });
    versions.find((v) => v.asset === sv.id && v.to === null)!.to = now - ago;   // the degraded version starts when the part failed
    versions.push({ asset: sv.id, ver: 2, rack: sv.rack, status: "degraded", from: now - ago, to: null, lsn: lsn++, loaded: +(now - ago + 0.1).toFixed(2), batch: "B-0412", who: "monitor" });
  }
  return { now, servers, versions, events: events.sort((a, b) => a.t - b.t), quarantine: [], lots, lsn, batch: 413 };
}

const health = (sv: Server) => (sv.comps.some((c) => c.status === "failed") ? "degraded" : "healthy");

type A = { type: "fail"; comp: string } | { type: "install"; comp: string } | { type: "move"; server: string; rack: string } | { type: "replay"; q: string; rack: string } | { type: "reset" };
function reduce(st: S, a: A): S {
  if (a.type === "reset") return seed();
  const now = +(st.now + 0.2).toFixed(2), batch = `B-${String(st.batch).padStart(4, "0")}`;
  // SCD2: close the current version, open a new one, with lineage
  const version = (s: S, sv: Server, who: string): Version[] => {
    const cur = s.versions.find((v) => v.asset === sv.id && v.to === null)!;
    if (cur.rack === sv.rack && cur.status === health(sv)) return s.versions; // nothing changed: no new version
    return [...s.versions.map((v) => (v === cur ? { ...v, to: now } : v)), { asset: sv.id, ver: cur.ver + 1, rack: sv.rack, status: health(sv), from: now, to: null, lsn: s.lsn, loaded: +(now + 0.01).toFixed(2), batch, who }];
  };
  if (a.type === "fail" || a.type === "install") {
    const sid = a.comp.split(":")[0], sv0 = st.servers.find((x) => x.id === sid)!, c0 = sv0.comps.find((c) => c.id === a.comp)!;
    let lots = st.lots, detail = c0.slot;
    let comp: Comp = { ...c0, status: a.type === "fail" ? "failed" : "ok" };
    if (a.type === "install") {
      const key = `${sv0.site}|${c0.part}`, pool = st.lots[key].map((l) => ({ ...l }));
      const lot = pool.find((l) => l.qty > 0); // FIFO: the pool is ordered oldest first
      if (lot) { lot.qty -= 1; comp = { ...comp, lot: lot.id, serial: `${c0.part.slice(0, 3).toUpperCase()}${Math.floor(1e6 + ((now * 7919) % 9e6))}`, installed: now }; detail = `${c0.slot} ← ${lot.id} (FIFO)`; }
      lots = { ...st.lots, [key]: pool };
    }
    const sv = { ...sv0, comps: sv0.comps.map((c) => (c.id === a.comp ? comp : c)) };
    const s1 = { ...st, servers: st.servers.map((x) => (x.id === sid ? sv : x)), lots };
    const restored = a.type === "install" && health(sv) === "healthy";
    return { ...s1, now, lsn: st.lsn + 1, batch: st.batch + 1, versions: version(s1, sv, ME), events: [...st.events, { t: now, asset: sid, act: a.type === "fail" ? "component failed" : restored ? "restored" : "spare installed", who: ME, detail }] };
  }
  if (a.type === "move" || a.type === "replay") {
    const qrow = a.type === "replay" ? st.quarantine.find((q) => q.id === a.q)! : null;
    const sid = a.type === "move" ? a.server : qrow!.asset, sv0 = st.servers.find((x) => x.id === sid)!;
    const target = a.rack, valid = layout(sv0.site).includes(target);
    if (!valid) { // contract failed: hold this row with its reason; nothing else is blocked
      return { ...st, now, quarantine: [...st.quarantine, { id: `Q-${st.quarantine.length + 1}`, asset: sid, field: "rack", value: target, reason: `rack ${target} is not in the ${sv0.site} layout`, at: now, state: "held" }], events: [...st.events, { t: now, asset: sid, act: "change quarantined", who: ME, detail: `rack → ${target}` }] };
    }
    const sv = { ...sv0, rack: target, hall: target.split("/")[1] };
    const s1 = { ...st, servers: st.servers.map((x) => (x.id === sid ? sv : x)), quarantine: qrow ? st.quarantine.map((q) => (q.id === qrow.id ? { ...q, state: "replayed" as const } : q)) : st.quarantine };
    return { ...s1, now, lsn: st.lsn + 1, batch: st.batch + 1, versions: version(s1, sv, ME), events: [...st.events, { t: now, asset: sid, act: qrow ? "corrected and replayed" : "moved", who: ME, detail: `→ ${target}` }] };
  }
  return st;
}

const hrs = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);
const q = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };

export function AssetTruth() {
  const [st, dispatch] = useReducer(reduce, undefined, seed);
  const [site, setSite] = useState<Site>("DC-A");
  const [sel, setSel] = useState("srv-0402");
  const [find, setFind] = useState("");
  const [tab, setTab] = useState<"history" | "events" | "quality">("history");
  const sv = st.servers.find((x) => x.id === sel) || st.servers[0];

  // mined: time from "component failed" to "restored", per site
  const restore = useMemo(() => {
    const open = new Map<string, number>(), out: { site: string; h: number }[] = [];
    for (const e of st.events) {
      if (e.act === "component failed" && !open.has(e.asset)) open.set(e.asset, e.t);
      if (e.act === "restored" && open.has(e.asset)) { out.push({ site: st.servers.find((x) => x.id === e.asset)!.site, h: e.t - open.get(e.asset)! }); open.delete(e.asset); }
    }
    return { all: q(out.map((x) => x.h), 0.5), p75: q(out.map((x) => x.h), 0.75), n: out.length, bySite: SITES.map((s) => ({ s, p75: q(out.filter((x) => x.site === s).map((x) => x.h), 0.75) })) };
  }, [st.events, st.servers]);
  const degraded = st.servers.filter((x) => health(x) === "degraded");
  const evs = st.events.filter((e) => e.asset === sv.id);
  const lastEv = evs[evs.length - 1];
  const failedComp = sv.comps.find((c) => c.status === "failed");
  const waitingSince = failedComp ? [...evs].reverse().find((e) => e.act === "component failed")?.t : undefined;
  const hits = find.trim().length >= 3 ? st.servers.filter((x) => x.id.includes(find.trim()) || x.comps.some((c) => c.serial.includes(find.trim().toUpperCase()) || c.lot.includes(find.trim().toUpperCase()))).slice(0, 6) : [];
  const otherRack = layout(sv.site).find((r) => r !== sv.rack)!;

  return (
    <div className="inbox at">
      <div className="ib-top">
        <div><b className="ib-title">Assets</b><span className="ib-sub">source of truth · {st.servers.length} servers, {st.servers.length * 4} components · synthetic data</span></div>
        <div className="row">
          <input className="ib-reason at-find" placeholder="Find a server, serial or lot (e.g. srv-0417, L-A)" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search assets" />
          <button className="btn btn-ghost ib-mini" onClick={() => { dispatch({ type: "reset" }); setSel("srv-0402"); setSite("DC-A"); }}>Reset demo</button>
        </div>
      </div>
      {hits.length > 0 && <div className="at-hits">{hits.map((h) => <button key={h.id} className="chip" onClick={() => { setSel(h.id); setSite(h.site); setFind(""); }}>{h.id} · {h.rack}</button>)}</div>}

      <div className="wo-kpis">
        <div><b>{st.servers.length}</b><span>servers tracked</span></div>
        <div><b className={degraded.length ? "bad" : "good"}>{degraded.length}</b><span>degraded, waiting for a spare</span></div>
        <div><b>{hrs(restore.p75)}</b><span>p75 failed → restored (mined, {restore.n} restores)</span></div>
        <div><b className={st.quarantine.some((x) => x.state === "held") ? "bad" : ""}>{st.quarantine.filter((x) => x.state === "held").length}</b><span>changes held in quarantine</span></div>
        <div><b>{st.versions.length}</b><span>SCD2 versions, all with lineage</span></div>
      </div>

      <div className="at-grid">
        <nav className="at-tree" aria-label="Asset hierarchy">
          <div className="seg" role="group" aria-label="Data centre">{SITES.map((s) => <button key={s} aria-pressed={site === s} onClick={() => setSite(s)}>{s}</button>)}</div>
          {HALLS.map((h) => (
            <div key={h} className="at-hall"><span className="ib-k">{h}</span>
              {RACKS.map((rk) => (
                <div key={rk} className="at-rack"><small>{rk}</small>
                  {st.servers.filter((x) => x.rack === `${site}/${h}/${rk}`).map((x) => (
                    <button key={x.id} className={"at-srv" + (x.id === sv.id ? " on" : "")} onClick={() => setSel(x.id)} aria-label={`${x.id}, ${health(x)}`}>
                      <i className={health(x)} aria-hidden="true" />{x.id}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <section className="at-main" aria-live="polite">
          <div className="at-head">
            <div><span className="eyebrow" style={{ margin: 0 }}>{sv.rack.split("/").join(" › ")} · U{sv.u}</span>
              <h3>{sv.id} <span className={"at-badge " + health(sv)}>{health(sv)}</span></h3></div>
            <div className="row">
              <button className="btn btn-ghost ib-mini" onClick={() => dispatch({ type: "move", server: sv.id, rack: otherRack })}>Move to {otherRack.split("/").slice(1).join("/")}</button>
              <button className="btn btn-ghost ib-mini" onClick={() => { dispatch({ type: "move", server: sv.id, rack: `${sv.site}/Hall 9/R99` }); setTab("quality"); }}>Try a bad move (R99)</button>
            </div>
          </div>
          <div className="wo-three">
            <div><span className="ib-k">Where it is</span><b>{sv.rack.split("/").slice(1).join(" › ")}</b><small>{sv.site} · U{sv.u}</small></div>
            <div><span className="ib-k">Who touched it last</span><b>{lastEv?.who || "import"}</b><small>{lastEv ? `${lastEv.act}, ${hrs(st.now - lastEv.t)} ago` : "initial load"}</small></div>
            <div><span className="ib-k">What it's waiting for</span><b>{failedComp ? `spare: ${failedComp.part}` : "nothing"}</b><small>{failedComp && waitingSince !== undefined ? `${failedComp.slot} failed ${hrs(st.now - waitingSince)} ago · p75 to restore at ${sv.site}: ${hrs(restore.bySite.find((b) => b.s === sv.site)!.p75)}` : "all components healthy"}</small></div>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>slot</th><th>part</th><th>serial</th><th>lot</th><th>status</th><th></th></tr></thead>
            <tbody>{sv.comps.map((c) => (
              <tr key={c.id} className={c.status === "failed" ? "below" : ""}>
                <td>{c.slot}</td><td>{c.part}</td><td><code>{c.serial}</code></td><td>{c.lot}</td><td>{c.status === "failed" ? "failed · waiting for spare" : "ok"}</td>
                <td>{c.status === "failed"
                  ? <button className="btn btn-primary ib-mini" onClick={() => dispatch({ type: "install", comp: c.id })}>Install spare (FIFO)</button>
                  : <button className="btn btn-ghost ib-mini" onClick={() => dispatch({ type: "fail", comp: c.id })}>Mark failed</button>}</td>
              </tr>))}</tbody>
          </table></div>

          <div className="seg" role="tablist" aria-label="Asset detail">
            <button role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>History (SCD2 + lineage)</button>
            <button role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>Events</button>
            <button role="tab" aria-selected={tab === "quality"} onClick={() => setTab("quality")}>Quality &amp; quarantine ({st.quarantine.filter((x) => x.state === "held").length})</button>
          </div>
          {tab === "history" && (<>
            <div className="table-wrap"><table>
              <thead><tr><th className="num">ver</th><th>rack</th><th>status</th><th className="num">valid_from</th><th className="num">valid_to</th><th>current</th><th className="num">source LSN</th><th className="num">loaded</th><th>batch</th></tr></thead>
              <tbody>{st.versions.filter((v) => v.asset === sv.id).map((v) => (
                <tr key={v.ver}><td className="num">{v.ver}</td><td>{v.rack.split("/").slice(1).join("/")}</td><td>{v.status}</td><td className="num">{v.from.toFixed(1)} h</td><td className="num">{v.to === null ? "–" : v.to.toFixed(1) + " h"}</td><td>{v.to === null ? "✓" : ""}</td><td className="num">{v.lsn}</td><td className="num">{v.loaded.toFixed(2)} h</td><td>{v.batch}</td></tr>))}</tbody>
            </table></div>
            <p className="small muted" style={{ margin: 0 }}>Every change closes the current row and opens a new one, so you can ask where this server was, and in what state, at any moment. Each row carries its source LSN, load time and batch: traceable to the source, like every record in Nexus.</p>
          </>)}
          {tab === "events" && (
            <ol className="wo-timeline">{evs.length ? evs.map((e, k) => <li key={k}><span>{e.t.toFixed(1)} h</span><b>{e.act}</b><em>{e.who}</em><small>{e.detail}</small></li>) : <li><span>–</span><b>no events yet</b></li>}</ol>
          )}
          {tab === "quality" && (<>
            <ul className="ib-rules">
              <li><b>✓ Rack must exist in the site layout</b><small>contract on every location change</small></li>
              <li><b>✓ Every installed component has a serial and a lot</b><small>so a recall can find it</small></li>
              <li><b>✓ One bad row never blocks the batch</b><small>it waits in quarantine with its reason, then is corrected and replayed</small></li>
            </ul>
            {st.quarantine.length === 0 ? <p className="small muted">Nothing held. Try a bad move to see a row quarantined.</p> : (
              <div className="table-wrap"><table>
                <thead><tr><th>id</th><th>asset</th><th>change</th><th>reason</th><th>state</th><th></th></tr></thead>
                <tbody>{st.quarantine.map((x) => (
                  <tr key={x.id} className={x.state === "held" ? "below" : ""}><td>{x.id}</td><td>{x.asset}</td><td>{x.field} → {x.value.split("/").slice(1).join("/")}</td><td>{x.reason}</td><td>{x.state}</td>
                    <td>{x.state === "held" && <button className="btn btn-primary ib-mini" onClick={() => { const a = st.servers.find((s) => s.id === x.asset)!; dispatch({ type: "replay", q: x.id, rack: layout(a.site).find((r) => r !== a.rack)! }); }}>Correct to {(() => { const a = st.servers.find((s) => s.id === x.asset)!; return layout(a.site).find((r) => r !== a.rack)!.split("/").slice(1).join("/"); })()} &amp; replay</button>}</td></tr>))}</tbody>
              </table></div>
            )}
          </>)}
        </section>
      </div>
    </div>
  );
}
