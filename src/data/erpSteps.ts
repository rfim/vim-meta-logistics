// SAP and Oracle ERP logs → one event log → mined → the agent's context → human review → rules and examples → re-mined.
// Runs on real PostgreSQL in the browser (PGlite). Tables are SAP- and Oracle-SHAPED and simplified,
// with SYNTHETIC data: no client data is used. Table names follow the real systems so the mapping is clear.
import type { Step } from "../components/Runner";

export const ERP_STEPS: Step[] = [
  {
    title: "SAP extract: POs, releases, goods receipts",
    why: "In SAP, a purchase order's life is spread across tables: EKKO holds the PO header, change documents (CDHDR) record the release (approval) made in ME29N, and EKBE holds PO history, where movement type 1 is the goods receipt. Simplified, with synthetic rows.",
    code: `CREATE TABLE ekko  (ebeln text PRIMARY KEY, werks text, lifnr text, ernam text, aedat timestamp);  -- PO header
CREATE TABLE cdhdr (objectclas text, objectid text, username text, udate timestamp, tcode text);  -- change documents
CREATE TABLE ekbe  (ebeln text, vgabe text, budat timestamp, menge numeric);                     -- PO history

INSERT INTO ekko VALUES
 ('4500001001','DC-A','V100','BUYER01','2026-10-01 09:00'), ('4500001002','DC-A','V101','BUYER02','2026-10-01 11:00'),
 ('4500001003','DC-B','V100','BUYER01','2026-10-02 08:00'), ('4500001004','DC-B','V102','BUYER03','2026-10-02 10:00'),
 ('4500001005','DC-A','V101','BUYER02','2026-10-03 09:00'), ('4500001006','DC-B','V100','BUYER01','2026-10-03 13:00');
INSERT INTO cdhdr VALUES   -- release strategy approvals (ME29N)
 ('EINKBELEG','4500001001','MGR_A','2026-10-02 15:00','ME29N'), ('EINKBELEG','4500001002','MGR_A','2026-10-01 14:00','ME29N'),
 ('EINKBELEG','4500001003','MGR_B','2026-10-03 17:00','ME29N'), ('EINKBELEG','4500001004','MGR_B','2026-10-02 12:00','ME29N'),
 ('EINKBELEG','4500001005','MGR_A','2026-10-04 18:00','ME29N'), ('EINKBELEG','4500001006','MGR_B','2026-10-05 09:00','ME29N');
INSERT INTO ekbe VALUES    -- vgabe '1' = goods receipt
 ('4500001001','1','2026-10-04 10:00',10), ('4500001002','1','2026-10-03 09:00',4), ('4500001003','1','2026-10-05 12:00',8),
 ('4500001004','1','2026-10-04 08:00',2),  ('4500001005','1','2026-10-06 11:00',6), ('4500001006','1','2026-10-07 10:00',12);

SELECT e.ebeln, e.werks, e.aedat AS created, c.udate AS released, b.budat AS received
FROM ekko e JOIN cdhdr c ON c.objectid = e.ebeln JOIN ekbe b ON b.ebeln = e.ebeln AND b.vgabe = '1'
ORDER BY e.ebeln;`,
  },
  {
    title: "Oracle extract: POs, approval history, receipts",
    why: "In Oracle E-Business Suite, the same story sits in PO_HEADERS_ALL, PO_ACTION_HISTORY (who submitted and who approved, and when) and RCV_TRANSACTIONS (the receipt). Simplified, with synthetic rows.",
    code: `CREATE TABLE po_headers_all    (po_header_id int PRIMARY KEY, segment1 text, org_code text, creation_date timestamp);
CREATE TABLE po_action_history (object_id int, action_code text, employee_id int, action_date timestamp);
CREATE TABLE rcv_transactions  (po_header_id int, transaction_type text, transaction_date timestamp);

INSERT INTO po_headers_all VALUES
 (1,'7001','DC-C','2026-10-01 10:00'), (2,'7002','DC-C','2026-10-02 09:00'),
 (3,'7003','DC-C','2026-10-02 15:00'), (4,'7004','DC-C','2026-10-03 08:00');
INSERT INTO po_action_history VALUES
 (1,'SUBMIT',501,'2026-10-01 11:00'), (1,'APPROVE',610,'2026-10-02 16:00'),
 (2,'SUBMIT',502,'2026-10-02 09:30'), (2,'APPROVE',610,'2026-10-02 13:30'),
 (3,'SUBMIT',501,'2026-10-02 16:00'), (3,'APPROVE',611,'2026-10-04 10:00'),
 (4,'SUBMIT',503,'2026-10-03 08:30'), (4,'APPROVE',610,'2026-10-04 12:30');
INSERT INTO rcv_transactions VALUES
 (1,'RECEIVE','2026-10-04 09:00'), (2,'RECEIVE','2026-10-04 10:00'),
 (3,'RECEIVE','2026-10-06 09:00'), (4,'RECEIVE','2026-10-06 15:00');

SELECT h.segment1 AS po, a.action_code, a.employee_id, a.action_date
FROM po_headers_all h JOIN po_action_history a ON a.object_id = h.po_header_id
ORDER BY h.segment1, a.action_date;`,
  },
  {
    title: "One event log from both ERPs",
    why: "Process mining needs three columns: case, activity and timestamp. One view maps both systems onto the same activities, so SAP and Oracle sites can be compared like for like.",
    code: `CREATE VIEW event_log AS
SELECT 'SAP' AS src, 'SAP:' || ebeln AS case_id, werks AS site, 'create' AS activity, aedat AS ts FROM ekko
UNION ALL
SELECT 'SAP', 'SAP:' || c.objectid, e.werks, 'approve', c.udate
FROM cdhdr c JOIN ekko e ON e.ebeln = c.objectid
WHERE c.objectclas = 'EINKBELEG' AND c.tcode = 'ME29N'
UNION ALL
SELECT 'SAP', 'SAP:' || b.ebeln, e.werks, 'receive', b.budat
FROM ekbe b JOIN ekko e USING (ebeln) WHERE b.vgabe = '1'
UNION ALL
SELECT 'Oracle', 'ORA:' || segment1, org_code, 'create', creation_date FROM po_headers_all
UNION ALL
SELECT 'Oracle', 'ORA:' || h.segment1, h.org_code, lower(a.action_code), a.action_date
FROM po_action_history a JOIN po_headers_all h ON h.po_header_id = a.object_id
UNION ALL
SELECT 'Oracle', 'ORA:' || h.segment1, h.org_code, 'receive', r.transaction_date
FROM rcv_transactions r JOIN po_headers_all h USING (po_header_id) WHERE r.transaction_type = 'RECEIVE';

SELECT src, activity, count(*) AS events
FROM event_log GROUP BY src, activity ORDER BY src, min(ts);`,
  },
  {
    title: "Mine it: where does the work wait?",
    why: "For every event, the wait is the time since the previous event in the same case. Approve → receive is the truck, not a queue. The queue is the wait before approve: about 30 h in both SAP and Oracle. The sites column is the start of the bias check.",
    code: `WITH seq AS (
  SELECT *, lag(activity) OVER w AS prev,
         extract(epoch FROM ts - lag(ts) OVER w) / 3600 AS wait_h
  FROM event_log WINDOW w AS (PARTITION BY case_id ORDER BY ts)
)
SELECT prev || ' → ' || activity AS step,
       count(*) AS cases,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY wait_h)::numeric, 1) AS median_wait_h,
       string_agg(DISTINCT site, ', ') AS sites
FROM seq WHERE prev IS NOT NULL
GROUP BY 1 ORDER BY median_wait_h DESC;`,
  },
  {
    title: "Write the agent's context pack",
    why: "The mined facts, the standing rules from past reviews and the approved examples are assembled into Claude Code's context. Rules and examples live in tables, so every review makes the next prompt better.",
    code: `CREATE TABLE review_rule (id serial PRIMARY KEY, rule text, source text);
CREATE TABLE fix_example (gap text, summary text, approved_by text);
INSERT INTO review_rule (rule, source) VALUES ('Never change a PO for a vendor that is not approved.', 'seed');

CREATE VIEW context_pack AS
WITH seq AS (
  SELECT *, extract(epoch FROM ts - lag(ts) OVER (PARTITION BY case_id ORDER BY ts)) / 3600 AS wait_h
  FROM event_log
), approve AS (
  SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY wait_h)::numeric, 1) AS med,
         count(*) AS n,
         string_agg(DISTINCT src, ' + ') AS sources
  FROM seq WHERE activity = 'approve'
)
SELECT format(E'## Context (mined from %s, synthetic sample)\\nBottleneck: "approve", median wait %s h over %s cases (target 8 h)\\n\\n## Rules from past reviews\\n%s\\n\\n## Approved examples\\n%s\\n\\n## Acceptance test\\nRe-mined median approve wait <= 8 h at every site, with no unapproved vendor.',
  a.sources, a.med, a.n,
  (SELECT string_agg('- ' || rule, E'\\n' ORDER BY id) FROM review_rule),
  COALESCE((SELECT string_agg('- ' || summary || ' (approved by ' || approved_by || ')', E'\\n') FROM fix_example), '- none yet')
) AS context_pack
FROM approve a;

SELECT context_pack FROM context_pack;`,
  },
  {
    title: "The agent drafts; a person reviews",
    why: "Claude Code drafts two fixes. A person approves one and rejects the other with a note. The rejected note becomes a standing rule, and the approved fix becomes a worked example. This is the feedback loop.",
    code: `CREATE TABLE agent_fix (id int, gap text, summary text, status text, reviewer text, note text);
INSERT INTO agent_fix VALUES
 (1, 'approve wait', 'Auto-release POs under the release-strategy limit for approved vendors',
     'approved', 'proc-lead:dewi', NULL),
 (2, 'approve wait', 'Skip approval entirely for repeat orders',
     'rejected', 'proc-lead:dewi',
     'Repeat orders still need a release. Read the limit from the SAP release strategy or the Oracle approval hierarchy; never hard-code it.');

INSERT INTO review_rule (rule, source) SELECT note, 'review of fix #' || id FROM agent_fix WHERE status = 'rejected';
INSERT INTO fix_example SELECT gap, summary, reviewer FROM agent_fix WHERE status = 'approved';

SELECT id, status, reviewer, COALESCE(note, '(approved: becomes an example)') AS outcome FROM agent_fix ORDER BY id;`,
  },
  {
    title: "Next cycle: the context got better",
    why: "Same query as step 5. The prompt now carries the reviewer's rule and the approved example, without anyone retraining a model.",
    code: `SELECT context_pack FROM context_pack;`,
  },
  {
    title: "Re-mine after the fix",
    why: "New POs arrive after the approved fix goes live, from both SAP and Oracle. Mining the same view again shows whether the approval wait really fell, at every site.",
    code: `INSERT INTO ekko VALUES
 ('4500001007','DC-A','V100','BUYER01','2026-10-20 09:00'), ('4500001008','DC-B','V101','BUYER02','2026-10-20 10:00'),
 ('4500001009','DC-A','V102','BUYER03','2026-10-21 08:00'), ('4500001010','DC-B','V100','BUYER01','2026-10-21 11:00');
INSERT INTO cdhdr VALUES
 ('EINKBELEG','4500001007','AUTO','2026-10-20 09:40','ME29N'), ('EINKBELEG','4500001008','AUTO','2026-10-20 11:00','ME29N'),
 ('EINKBELEG','4500001009','MGR_A','2026-10-21 14:00','ME29N'), ('EINKBELEG','4500001010','AUTO','2026-10-21 11:30','ME29N');
INSERT INTO po_headers_all VALUES (5,'7005','DC-C','2026-10-20 10:00'), (6,'7006','DC-C','2026-10-21 09:00');
INSERT INTO po_action_history VALUES
 (5,'SUBMIT',501,'2026-10-20 10:15'), (5,'APPROVE',610,'2026-10-20 11:15'),
 (6,'SUBMIT',502,'2026-10-21 09:10'), (6,'APPROVE',610,'2026-10-21 12:10');

WITH seq AS (
  SELECT *, extract(epoch FROM ts - lag(ts) OVER (PARTITION BY case_id ORDER BY ts)) / 3600 AS wait_h,
         min(ts) OVER (PARTITION BY case_id) AS started
  FROM event_log
)
SELECT CASE WHEN started < '2026-10-15' THEN '1 · before the fix' ELSE '2 · after the fix' END AS period,
       site, count(*) AS cases,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY wait_h)::numeric, 1) AS median_approve_wait_h
FROM seq WHERE activity = 'approve'
GROUP BY 1, 2 ORDER BY 1, 2;`,
  },
];
