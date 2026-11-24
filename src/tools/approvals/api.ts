// Spares Approvals: the service layer. Every write runs in one transaction,
// re-checks policy against the locked row, and appends an audit event.
import type { DB } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Role = "technician" | "approver" | "senior_approver";
export type User = { id: string; name: string; role: Role; site_id: string | null };
export type Status = "awaiting approval" | "info requested" | "approved" | "rejected" | "cancelled";
export type Req = {
  id: string; ticket: string; part_id: string; part: string; site_id: string; qty: number; like_for_like: boolean;
  failed_serial: string | null; note: string | null; requester_id: string; requester: string; created_at: string;
  status: Status; decided_by: string | null; decider: string | null; decided_at: string | null; decision_note: string | null; reserved: string | null;
  age_h: number; on_hand: number; approval_limit: number; unit_cost_gbp: number;
};
export type Ev = { id: number; request_id: string; at: string; actor_id: string; actor: string; action: string; detail: string | null };
export type Lot = { id: string; received_at: string; qty: number };
export type Check = { ok: boolean; text: string; info?: boolean };

export const SLA_H = 24;

const REQ_SQL = `
  select r.*, p.name part, p.approval_limit, p.unit_cost_gbp::float unit_cost_gbp, u.name requester, d.name decider,
         extract(epoch from (now() - r.created_at)) / 3600 age_h,
         (select coalesce(sum(qty),0)::int from lot l where l.part_id = r.part_id and l.site_id = r.site_id) on_hand
  from request r join part p on p.id = r.part_id join app_user u on u.id = r.requester_id left join app_user d on d.id = r.decided_by`;

// timestamptz comes back as Date: keep ISO strings in the UI
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null));
const norm = (r: Req): Req => ({ ...r, age_h: +r.age_h, created_at: iso(r.created_at)!, decided_at: iso(r.decided_at) });

export async function users(db: DB) { return (await db.query<User>(`select * from app_user order by role, id`)).rows; }
export async function parts(db: DB) { return (await db.query<{ id: string; name: string; approval_limit: number }>(`select id, name, approval_limit from part order by id`)).rows; }
export async function sites(db: DB) { return (await db.query<{ id: string }>(`select id from site order by id`)).rows.map((r) => r.id); }

export async function listRequests(db: DB) {
  return (await db.query<Req>(REQ_SQL + ` order by r.created_at`)).rows.map(norm);
}
export async function history(db: DB, id: string) {
  return (await db.query<Ev>(`select e.*, u.name actor from event e join app_user u on u.id = e.actor_id where request_id = $1 order by at, e.id`, [id])).rows;
}
export async function fifo(db: DB, part: string, site: string) {
  return (await db.query<Lot>(`select id, received_at, qty from lot where part_id = $1 and site_id = $2 and qty > 0 order by received_at, id`, [part, site])).rows;
}
export async function auditLog(db: DB, limit = 200) {
  return (await db.query<Ev>(`select e.*, u.name actor from event e join app_user u on u.id = e.actor_id order by at desc, e.id desc limit $1`, [limit])).rows;
}
export async function stockTable(db: DB) {
  return (await db.query<{ part_id: string; part: string; site_id: string; on_hand: number }>(`select * from stock order by part_id, site_id`)).rows;
}

/** Who may see a request in their approval queue. */
export const inScope = (u: User, r: { site_id: string }) => u.role === "senior_approver" || (u.role === "approver" && u.site_id === r.site_id);

/** Policy: plain, written-down rules. The same function runs in the UI and inside the approve transaction. */
export function policy(u: User, r: Pick<Req, "requester_id" | "site_id" | "qty" | "approval_limit" | "on_hand" | "like_for_like" | "age_h" | "status">): Check[] {
  const senior = u.role === "senior_approver";
  return [
    { ok: r.status === "awaiting approval", text: r.status === "awaiting approval" ? "Awaiting approval" : `Status is “${r.status}”` },
    { ok: u.role !== "technician", text: u.role !== "technician" ? `You are ${senior ? "a senior approver" : "an approver"}` : "Technicians cannot approve" },
    { ok: inScope(u, r), text: inScope(u, r) ? `${r.site_id} is in your scope` : `${r.site_id} is outside your scope (${u.site_id ?? "none"})` },
    { ok: u.id !== r.requester_id, text: u.id !== r.requester_id ? "Not your own request" : "You raised this request: someone else must approve it" },
    { ok: r.qty <= r.approval_limit || senior, text: r.qty <= r.approval_limit ? `Quantity ${r.qty} is within the limit of ${r.approval_limit}` : senior ? `Quantity ${r.qty} is over the limit of ${r.approval_limit}: senior sign-off (you)` : `Quantity ${r.qty} is over the limit of ${r.approval_limit}: needs a senior approver` },
    { ok: r.like_for_like || senior, text: r.like_for_like ? "Like-for-like replacement" : senior ? "Not like-for-like: senior sign-off (you)" : "Not like-for-like: needs a senior approver" },
    { ok: r.on_hand >= r.qty, text: r.on_hand >= r.qty ? `${r.on_hand} on hand at ${r.site_id}` : `Only ${r.on_hand} on hand at ${r.site_id}: cannot reserve ${r.qty}` },
    { ok: true, info: true, text: r.age_h > SLA_H ? `Past the ${SLA_H} h approval SLA` : `Within the ${SLA_H} h approval SLA` },
  ];
}
export const canApprove = (checks: Check[]) => checks.every((c) => c.ok);

export class Refused extends Error {}
async function locked(tx: any, id: string): Promise<Req> {
  await tx.query(`select 1 from request where id = $1 for update`, [id]);
  const r = (await tx.query(REQ_SQL + ` where r.id = $1`, [id])).rows[0] as Req | undefined;
  if (!r) throw new Refused(`${id} not found`);
  return norm(r);
}
const log = (tx: any, id: string, u: User, action: string, detail: string | null) =>
  tx.query(`insert into event (request_id, actor_id, action, detail) values ($1, $2, $3, $4)`, [id, u.id, action, detail]);

export async function approve(db: DB, u: User, id: string, note = "") {
  return db.transaction(async (tx) => {
    const r = await locked(tx, id);
    const bad = policy(u, r).filter((c) => !c.ok);
    if (bad.length) throw new Refused(bad.map((c) => c.text).join("; "));
    // reserve stock, oldest lot first (FIFO)
    let left = r.qty; const used: string[] = [];
    for (const l of (await tx.query(`select id, qty from lot where part_id = $1 and site_id = $2 and qty > 0 order by received_at, id for update`, [r.part_id, r.site_id])).rows as Lot[]) {
      if (left <= 0) break;
      const take = Math.min(l.qty, left);
      await tx.query(`update lot set qty = qty - $1 where id = $2`, [take, l.id]);
      used.push(`${l.id}×${take}`); left -= take;
    }
    if (left > 0) throw new Refused("Stock changed: not enough to reserve");
    await tx.query(`update request set status = 'approved', decided_by = $1, decided_at = now(), decision_note = $2, reserved = $3 where id = $4`, [u.id, note || null, used.join(", "), id]);
    await log(tx, id, u, "approved", `reserved ${used.join(", ")}${note ? ` · ${note}` : ""}`);
  });
}

export async function reject(db: DB, u: User, id: string, reason: string) {
  if (reason.trim().length < 8) throw new Refused("A reason of at least 8 characters is required");
  return db.transaction(async (tx) => {
    const r = await locked(tx, id);
    if (r.status !== "awaiting approval") throw new Refused(`Status is “${r.status}”`);
    if (!inScope(u, r)) throw new Refused("Outside your scope");
    if (u.id === r.requester_id) throw new Refused("Cancel your own request instead");
    await tx.query(`update request set status = 'rejected', decided_by = $1, decided_at = now(), decision_note = $2 where id = $3`, [u.id, reason.trim(), id]);
    await log(tx, id, u, "rejected", reason.trim());
  });
}

export async function askInfo(db: DB, u: User, id: string, question: string) {
  if (question.trim().length < 5) throw new Refused("Write the question for the requester");
  return db.transaction(async (tx) => {
    const r = await locked(tx, id);
    if (r.status !== "awaiting approval" || !inScope(u, r)) throw new Refused("Cannot ask on this request");
    await tx.query(`update request set status = 'info requested' where id = $1`, [id]);
    await log(tx, id, u, "info requested", question.trim());
  });
}

export async function reply(db: DB, u: User, id: string, answer: string) {
  if (answer.trim().length < 2) throw new Refused("Write an answer");
  return db.transaction(async (tx) => {
    const r = await locked(tx, id);
    if (r.status !== "info requested" || r.requester_id !== u.id) throw new Refused("Only the requester can answer");
    await tx.query(`update request set status = 'awaiting approval' where id = $1`, [id]);
    await log(tx, id, u, "info given", answer.trim());
  });
}

export async function cancel(db: DB, u: User, id: string) {
  return db.transaction(async (tx) => {
    const r = await locked(tx, id);
    if (r.requester_id !== u.id || !["awaiting approval", "info requested"].includes(r.status)) throw new Refused("Only the requester can cancel an open request");
    await tx.query(`update request set status = 'cancelled' where id = $1`, [id]);
    await log(tx, id, u, "cancelled", null);
  });
}

export type NewReq = { ticket: string; part_id: string; site_id: string; qty: number; like_for_like: boolean; failed_serial: string; note: string };
export function validate(n: NewReq): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^T-\d{5}$/.test(n.ticket.trim())) e.ticket = "Format T-12345";
  if (!n.part_id) e.part_id = "Choose a part";
  if (!(n.qty >= 1 && n.qty <= 50)) e.qty = "1 to 50";
  if (n.like_for_like && !n.failed_serial.trim()) e.failed_serial = "Serial of the failed part is required for like-for-like";
  if (!n.like_for_like && n.note.trim().length < 10) e.note = "Say why it isn't like-for-like (10+ characters)";
  return e;
}
export async function create(db: DB, u: User, n: NewReq) {
  const e = validate(n);
  if (Object.keys(e).length) throw new Refused(Object.values(e).join("; "));
  if (u.role === "technician" && u.site_id !== n.site_id) throw new Refused(`You can request for ${u.site_id} only`);
  return db.transaction(async (tx) => {
    const id = "REQ-" + (await tx.query(`select nextval('request_no') n`)).rows[0].n;
    await tx.query(`insert into request (id, ticket, part_id, site_id, qty, like_for_like, failed_serial, note, requester_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, n.ticket.trim(), n.part_id, n.site_id, n.qty, n.like_for_like, n.failed_serial.trim() || null, n.note.trim() || null, u.id]);
    await log(tx, id, u, "requested", `${n.qty} × ${n.part_id} for ${n.site_id}`);
    return id as string;
  });
}

/** Read-only SQL for the Data tab: runs inside a read-only transaction that is always rolled back. */
const ROLLBACK = new Error("rollback");
export async function readOnly(db: DB, sql: string) {
  const q = sql.trim().replace(/;\s*$/, "");
  if (q.includes(";")) throw new Refused("One statement at a time");
  let res: { rows: Record<string, unknown>[]; fields: { name: string }[] } | undefined;
  try { await db.transaction(async (tx) => { await tx.exec("set transaction read only"); res = await tx.query(q); throw ROLLBACK; }); }
  catch (e) { if (e !== ROLLBACK) throw e; }
  return res!;
}

/** Proves the audit log is append-only: tries to delete the newest event, inside a transaction that is rolled back. */
export async function tryTamper(db: DB): Promise<string> {
  try { await db.transaction(async (tx) => { await tx.query(`delete from event where id = (select max(id) from event)`); throw ROLLBACK; }); return "Deleted (this should not happen)"; }
  catch (e) { return e === ROLLBACK ? "Deleted (this should not happen)" : String((e as Error).message); }
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
