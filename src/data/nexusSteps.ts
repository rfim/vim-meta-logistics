// Nexus, step by step. Production ran on Databricks; this is a faithful PostgreSQL port (PGlite)
// so the pattern can run in the browser. Synthetic sample: the change events are made up.
import type { Step } from "../components/Runner";

export const NEXUS_STEPS: Step[] = [
  {
    title: "Land raw change events in Bronze",
    why: "Debezium sends every insert, update and delete as an event, and Kafka can deliver some of them twice or out of order. Bronze keeps them all, untouched, so the history can always be replayed.",
    code: `CREATE TABLE bronze_policy_cdc (
  kafka_offset bigint,
  op     text,      -- c create, u update, d delete
  lsn    bigint,    -- source log sequence number: the true order
  ts     timestamptz,
  after  jsonb,
  before jsonb
);

INSERT INTO bronze_policy_cdc VALUES
 (1, 'c', 10, now() - interval '9 min', '{"policy_id":101,"status":"quoted","premium":42.00}', NULL),
 (2, 'u', 20, now() - interval '8 min', '{"policy_id":101,"status":"active","premium":42.00}', NULL),
 (3, 'c', 10, now() - interval '9 min', '{"policy_id":101,"status":"quoted","premium":42.00}', NULL), -- replayed duplicate
 (4, 'c', 15, now() - interval '7 min', '{"policy_id":102,"status":"quoted","premium":18.50}', NULL),
 (5, 'u', 30, now() - interval '3 min', '{"policy_id":102,"status":"active","premium":19.00}', NULL),
 (6, 'u', 25, now() - interval '4 min', '{"policy_id":102,"status":"quoted","premium":18.75}', NULL), -- arrives late
 (7, 'c', 12, now() - interval '6 min', '{"policy_id":103,"status":"quoted","premium":30.00}', NULL),
 (8, 'd', 40, now() - interval '2 min', NULL, '{"policy_id":103}');

SELECT kafka_offset, op, lsn, COALESCE(after, before) ->> 'policy_id' AS policy_id,
       after ->> 'status' AS status, after ->> 'premium' AS premium
FROM bronze_policy_cdc ORDER BY kafka_offset;`,
  },
  {
    title: "MERGE into Silver: the newest change wins",
    why: "Keep only the newest event per policy, ordered by LSN (not arrival). Then MERGE: delete, update only if newer, or insert. The replay and the late event can't overwrite fresher data.",
    code: `CREATE TABLE silver_policy (
  policy_id bigint PRIMARY KEY,
  status    text,
  premium   numeric(14,2),
  _lsn      bigint,
  _source_ts timestamptz
);

MERGE INTO silver_policy AS t
USING (
  SELECT * FROM (
    SELECT (COALESCE(after, before) ->> 'policy_id')::bigint AS policy_id,
           after ->> 'status' AS status, (after ->> 'premium')::numeric AS premium,
           op, lsn, ts,
           ROW_NUMBER() OVER (PARTITION BY COALESCE(after, before) ->> 'policy_id'
                              ORDER BY lsn DESC, kafka_offset DESC) AS rn
    FROM bronze_policy_cdc
  ) x WHERE rn = 1
) AS s
ON t.policy_id = s.policy_id
WHEN MATCHED AND s.op = 'd' THEN DELETE
WHEN MATCHED AND s.lsn > t._lsn THEN
  UPDATE SET status = s.status, premium = s.premium, _lsn = s.lsn, _source_ts = s.ts
WHEN NOT MATCHED AND s.op <> 'd' THEN
  INSERT (policy_id, status, premium, _lsn, _source_ts) VALUES (s.policy_id, s.status, s.premium, s.lsn, s.ts);

SELECT policy_id, status, premium, _lsn FROM silver_policy ORDER BY policy_id;`,
  },
  {
    title: "Replay the whole topic: nothing changes",
    why: "Idempotent by design. Running the same MERGE again over the same events leaves Silver exactly as it was, so a replay after an outage is safe.",
    code: `MERGE INTO silver_policy AS t
USING (
  SELECT * FROM (
    SELECT (COALESCE(after, before) ->> 'policy_id')::bigint AS policy_id,
           after ->> 'status' AS status, (after ->> 'premium')::numeric AS premium, op, lsn, ts,
           ROW_NUMBER() OVER (PARTITION BY COALESCE(after, before) ->> 'policy_id' ORDER BY lsn DESC, kafka_offset DESC) AS rn
    FROM bronze_policy_cdc) x WHERE rn = 1
) AS s
ON t.policy_id = s.policy_id
WHEN MATCHED AND s.op = 'd' THEN DELETE
WHEN MATCHED AND s.lsn > t._lsn THEN UPDATE SET status = s.status, premium = s.premium, _lsn = s.lsn, _source_ts = s.ts
WHEN NOT MATCHED AND s.op <> 'd' THEN INSERT (policy_id, status, premium, _lsn, _source_ts) VALUES (s.policy_id, s.status, s.premium, s.lsn, s.ts);

SELECT count(*) AS rows_in_silver, string_agg(policy_id || ':' || status, ', ' ORDER BY policy_id) AS state
FROM silver_policy;`,
  },
  {
    title: "Critical checks before Gold",
    why: "A release needs every critical check to pass. An average score must not hide one broken rule.",
    code: `SELECT 'policy_id unique' AS check_name,
       count(*) = count(DISTINCT policy_id) AS pass FROM silver_policy
UNION ALL
SELECT 'premium not negative', bool_and(premium >= 0) FROM silver_policy
UNION ALL
SELECT 'status in domain', bool_and(status IN ('quoted','active','lapsed','cancelled')) FROM silver_policy
UNION ALL
SELECT 'no deleted policy survived', NOT EXISTS (SELECT 1 FROM silver_policy WHERE policy_id = 103);`,
  },
  {
    title: "Volume hold: |V − μ30| > 3σ30",
    why: "Compare today's load with the last 30 days. If it's too far out, hold Gold and page the owner, rather than publish numbers nobody should trust.",
    code: `CREATE TABLE load_log AS
SELECT current_date - d AS day,
       (1000 + (d % 7) * 25 + (d % 3) * 10)::int AS rows_loaded
FROM generate_series(1, 30) AS d;
INSERT INTO load_log VALUES (current_date, 2400);   -- today's suspicious load

WITH stats AS (
  SELECT avg(rows_loaded) AS mu, stddev(rows_loaded) AS sigma
  FROM load_log WHERE day < current_date
)
SELECT l.rows_loaded AS today, round(s.mu, 1) AS mu30, round(s.sigma, 1) AS sigma30,
       CASE WHEN abs(l.rows_loaded - s.mu) > 3 * s.sigma THEN 'HOLD' ELSE 'PASS' END AS gate
FROM load_log l CROSS JOIN stats s
WHERE l.day = current_date;`,
  },
  {
    title: "Freshness, the way a consumer feels it",
    why: "Measure the age of the newest source event a reader can actually query, against the SLA. Reporting at Lifepal went from 24 h to 5 min.",
    code: `SELECT 'silver_policy' AS dataset,
       round(extract(epoch FROM now() - max(_source_ts)) / 60, 1) AS minutes_behind,
       5 AS sla_minutes,
       extract(epoch FROM now() - max(_source_ts)) / 60 <= 5 AS within_sla
FROM silver_policy;`,
  },
];
