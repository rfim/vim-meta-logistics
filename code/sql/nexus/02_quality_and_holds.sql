-- Nexus (Lifepal) · quality gates before Gold · hold a load if |V − μ30| > 3σ30
-- Databricks SQL. The pattern behind 500+ checks; written for this portfolio, not production code.

-- 1. Volume anomaly hold: today's rows vs the last 30 days for the same table
WITH daily AS (
  SELECT DATE(_source_loaded_at) AS d, COUNT(*) AS v
  FROM   silver.policy
  WHERE  _source_loaded_at >= current_date() - INTERVAL 31 DAYS
  GROUP  BY 1
), stats AS (
  SELECT AVG(v) AS mu, STDDEV(v) AS sigma FROM daily WHERE d < current_date()
)
SELECT d.v AS today, s.mu, s.sigma,
       CASE WHEN ABS(d.v - s.mu) > 3 * s.sigma THEN 'HOLD' ELSE 'PASS' END AS gate
FROM   daily d CROSS JOIN stats s
WHERE  d.d = current_date();
-- The orchestrator (Airflow) reads `gate`: HOLD stops the Gold publish and pages the owner.

-- 2. Critical checks: a release needs every one to pass (an average must not hide a broken rule)
SELECT 'policy_id unique'        AS check_name, COUNT(*) - COUNT(DISTINCT policy_id) = 0          AS pass FROM silver.policy
UNION ALL
SELECT 'premium not negative',   COUNT_IF(premium < 0) = 0                                        FROM silver.policy
UNION ALL
SELECT 'status in domain',       COUNT_IF(status NOT IN ('quoted','active','lapsed','cancelled')) = 0 FROM silver.policy
UNION ALL
SELECT 'every claim has a policy',
       NOT EXISTS (SELECT 1 FROM silver.claim c LEFT ANTI JOIN silver.policy p ON c.policy_id = p.policy_id);

-- 3. Freshness, measured the way a consumer feels it: age of the newest visible source event
SELECT 'silver.policy' AS dataset,
       ROUND((unix_timestamp(current_timestamp()) - unix_timestamp(MAX(_source_ts))) / 60, 1) AS minutes_behind,
       5 AS sla_minutes,                                                   -- reporting went 24 h → 5 min
       (unix_timestamp(current_timestamp()) - unix_timestamp(MAX(_source_ts))) / 60 <= 5 AS within_sla
FROM   silver.policy;
