// Spares Approvals: the data layer of a real internal tool.
// PostgreSQL (PGlite, compiled to WebAssembly) persisted in this browser's IndexedDB.
// No Fettle here: no mined context, no AI suggestion, no rules learned from rejections.
// Just the tool a team would build first: a schema with constraints, policy in code,
// every change in one transaction, and an append-only audit log. Data is SYNTHETIC.
import { PGLITE_URL } from "../../lib/engines";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DB = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; fields: { name: string }[] }>; exec(sql: string): Promise<unknown>; transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>; close(): Promise<void> };

export const DB_NAME = "idb://spares-approvals-v2";

export const SCHEMA = `
create table site (
  id    text primary key,
  name  text not null
);
create table app_user (
  id    text primary key,
  name  text not null,
  role  text not null check (role in ('technician','approver','senior_approver')),
  site_id text references site(id)          -- null = all sites
);
create table part (
  id   text primary key,
  name text not null,
  approval_limit int not null check (approval_limit > 0),   -- above this, a senior approver must sign
  unit_cost_gbp numeric(10,2) not null
);
create table lot (
  id text primary key,
  part_id text not null references part(id),
  site_id text not null references site(id),
  received_at timestamptz not null,
  qty int not null check (qty >= 0)
);
create table request (
  id text primary key,
  ticket text not null check (ticket ~ '^T-[0-9]{5}$'),
  part_id text not null references part(id),
  site_id text not null references site(id),
  qty int not null check (qty between 1 and 50),
  like_for_like boolean not null,
  failed_serial text,
  note text,
  requester_id text not null references app_user(id),
  created_at timestamptz not null default now(),
  status text not null default 'awaiting approval'
    check (status in ('awaiting approval','info requested','approved','rejected','cancelled')),
  decided_by text references app_user(id),
  decided_at timestamptz,
  decision_note text,
  reserved text,
  check (not like_for_like or failed_serial is not null),
  check (status not in ('approved','rejected') or decided_by is not null),
  check (decided_by is null or decided_by <> requester_id)          -- nobody approves their own request
);
create sequence request_no start 2001;
create table event (
  id bigint generated always as identity primary key,
  request_id text not null references request(id),
  at timestamptz not null default now(),
  actor_id text not null references app_user(id),
  action text not null,
  detail text
);
-- the audit log is append-only
create function no_change() returns trigger language plpgsql as $$
begin raise exception 'event is append-only'; end $$;
create trigger event_append_only before update or delete on event for each row execute function no_change();
create index on request (status, site_id, created_at);
create index on event (request_id, at);
create view stock as
  select p.id part_id, p.name part, s.id site_id, coalesce(sum(l.qty), 0)::int on_hand
  from part p cross join site s left join lot l on l.part_id = p.id and l.site_id = s.id
  group by p.id, p.name, s.id;
`;

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
const lit = (v: unknown) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

/** Seed data, timed relative to now so the queue ages are believable. */
export function seedSQL(): string {
  const r = rng(7), out: string[] = [];
  out.push(`insert into site values ('DC-A','Data centre A'),('DC-B','Data centre B'),('DC-C','Data centre C');`);
  out.push(`insert into app_user values
    ('ana','Ana (technician, DC-A)','technician','DC-A'),
    ('ben','Ben (technician, DC-B)','technician','DC-B'),
    ('kofi','Kofi (technician, DC-C)','technician','DC-C'),
    ('cy','Cy (site lead, DC-A)','approver','DC-A'),
    ('dee','Dee (site lead, DC-B)','approver','DC-B'),
    ('eli','Eli (site lead, DC-C)','approver','DC-C'),
    ('mo','Mo (logistics manager, all sites)','senior_approver',null);`);
  out.push(`insert into part values
    ('SSD','SSD 3.84 TB',4,310),('DIMM','DIMM 64 GB',8,240),('PSU','PSU 2 kW',2,420),('NIC','NIC 100G',2,690),('FAN','Fan module',6,55);`);
  const parts = ["SSD", "DIMM", "PSU", "NIC", "FAN"], sites = ["DC-A", "DC-B", "DC-C"];
  let n = 500;
  for (const p of parts) for (const s of sites) for (let k = 0; k < 3; k++) {
    const low = (p === "PSU" && s === "DC-A") || (p === "SSD" && s === "DC-C");
    out.push(`insert into lot values ('L-${n++}','${p}','${s}', now() - interval '${60 - k * 18 + Math.floor(r() * 6)} days', ${low ? 1 : 2 + Math.floor(r() * 8)});`);
  }
  const techBy: Record<string, string> = { "DC-A": "ana", "DC-B": "ben", "DC-C": "kofi" };
  const leadBy: Record<string, string> = { "DC-A": "cy", "DC-B": "dee", "DC-C": "eli" };
  // open work: [part, site, qty, like-for-like, hours ago, status]
  const open: [string, string, number, boolean, number, string][] = [
    ["SSD", "DC-C", 2, true, 31, "awaiting approval"], ["DIMM", "DC-A", 4, true, 4, "awaiting approval"],
    ["PSU", "DC-A", 2, true, 26, "awaiting approval"], ["FAN", "DC-B", 1, true, 2, "awaiting approval"],
    ["NIC", "DC-C", 4, true, 44, "awaiting approval"], ["DIMM", "DC-C", 6, false, 7, "awaiting approval"],
    ["SSD", "DC-A", 1, true, 1.5, "awaiting approval"], ["FAN", "DC-C", 2, true, 9, "info requested"],
    ["DIMM", "DC-B", 2, true, 50, "approved"], ["SSD", "DC-B", 1, true, 70, "rejected"],
  ];
  // three weeks of closed history, so approval times by site mean something (DC-C is slowest)
  let hid = 901, htk = 87900;
  for (let k = 0; k < 42; k++) {
    const s = sites[k % 3], p = parts[Math.floor(r() * parts.length)], rid = `REQ-0${hid++}`, who = techBy[s];
    const ago = 24 * 21 - k * 11 - Math.floor(r() * 6), slow = r() < (s === "DC-C" ? 0.5 : 0.2);
    const wait = +(slow ? 20 + r() * 34 : 0.5 + r() * 6).toFixed(1), rej = r() < 0.1;
    const at = `now() - interval '${ago} hours'`, dec = `${at} + interval '${wait} hours'`;
    out.push(`insert into request (id,ticket,part_id,site_id,qty,like_for_like,failed_serial,requester_id,created_at,status,decided_by,decided_at,decision_note) values
      (${lit(rid)},'T-${htk++}',${lit(p)},${lit(s)},1,true,'SN-${s.slice(3)}${Math.floor(100000 + r() * 899999)}',${lit(who)},${at},${lit(rej ? "rejected" : "approved")},${lit(leadBy[s])},${dec},${lit(rej ? "Wrong part number on the ticket" : null)});`);
    out.push(`insert into event (request_id,at,actor_id,action,detail) values (${lit(rid)},${at},${lit(who)},'requested',${lit(`1 × ${p} for ${s}`)}),(${lit(rid)},${dec},${lit(leadBy[s])},${lit(rej ? "rejected" : "approved")},${lit(rej ? "Wrong part number on the ticket" : "approved")});`);
  }
  let id = 1001, tk = 88100;
  for (const [p, s, q, lfl, h, st] of open) {
    const rid = `REQ-${id++}`, who = techBy[s], at = `now() - interval '${h} hours'`;
    const serial = lfl ? `SN-${s.slice(3)}${Math.floor(100000 + r() * 899999)}` : null;
    const decided = st === "approved" || st === "rejected";
    const note = st === "rejected" ? "Duplicate of REQ-0998, already shipped" : null;
    out.push(`insert into request (id,ticket,part_id,site_id,qty,like_for_like,failed_serial,note,requester_id,created_at,status,decided_by,decided_at,decision_note,reserved) values
      (${lit(rid)},'T-${tk++}',${lit(p)},${lit(s)},${q},${lfl},${lit(serial)},${lit(lfl ? null : "Upgrade from 32 GB during the repair")},${lit(who)},${at},${lit(st)},${decided ? lit(leadBy[s]) : "null"},${decided ? `${at} + interval '3 hours'` : "null"},${lit(note)},null);`);
    out.push(`insert into event (request_id,at,actor_id,action,detail) values (${lit(rid)},${at},${lit(who)},'requested',${lit(`${q} × ${p} for ${s}`)});`);
    if (st === "info requested") out.push(`insert into event (request_id,at,actor_id,action,detail) values (${lit(rid)},${at} + interval '2 hours',${lit(leadBy[s])},'info requested','Which rack and slot? The serial does not match our records.');`);
    if (decided) out.push(`insert into event (request_id,at,actor_id,action,detail) values (${lit(rid)},${at} + interval '3 hours',${lit(leadBy[s])},${lit(st)},${lit(note || "approved")});`);
  }
  return out.join("\n");
}

let shared: Promise<{ db: DB; persisted: boolean }> | null = null;

/** Open (or create) the database. Persisted in IndexedDB when the browser allows it, in memory otherwise. */
export function openDB(): Promise<{ db: DB; persisted: boolean }> {
  if (shared) return shared;
  shared = (async () => {
    const { PGlite }: any = await import(/* @vite-ignore */ PGLITE_URL);
    let db: DB, persisted = true;
    try { db = new PGlite(DB_NAME); await (db as any).waitReady; }
    catch { db = new PGlite(); await (db as any).waitReady; persisted = false; }
    const has = await db.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name = 'request'`);
    if (!has.rows[0].n) { await db.exec(SCHEMA); await db.exec(seedSQL()); }
    return { db, persisted };
  })();
  shared.catch(() => { shared = null; });
  return shared;
}

/** Drop everything and seed again. */
export async function resetDB(db: DB) {
  await db.exec(`drop schema public cascade; create schema public;`);
  await db.exec(SCHEMA);
  await db.exec(seedSQL());
}
