-- Nexus (Lifepal) · Gold: a Kimball star that Finance, Marketing, CRM and Product share
-- dbt model (Databricks). Written for this portfolio to show the pattern, not production code.

{{ config(materialized='incremental', unique_key='policy_day_key', incremental_strategy='merge',
          partition_by=['snapshot_date'], tags=['gold', 'certified']) }}

WITH policy AS (
  SELECT * FROM {{ ref('silver_policy') }}
), dim_product AS (
  SELECT product_key, product_code FROM {{ ref('dim_product') }} WHERE is_current
), dim_partner AS (
  SELECT partner_key, partner_code FROM {{ ref('dim_partner') }} WHERE is_current
)
SELECT
  {{ dbt_utils.generate_surrogate_key(['p.policy_id', 'current_date()']) }} AS policy_day_key,
  current_date()                         AS snapshot_date,
  p.policy_id,
  dp.product_key,
  dr.partner_key,
  p.status,
  p.premium,
  p.premium * 12                         AS annualised_premium,
  p._source_ts                           AS source_updated_at,   -- lineage: every row traceable to its
  p._lsn                                 AS source_lsn           -- source, load time and batch
FROM policy p
LEFT JOIN dim_product dp ON dp.product_code = p.product_code
LEFT JOIN dim_partner dr ON dr.partner_code = p.partner_code
{% if is_incremental() %}
WHERE p._source_loaded_at > (SELECT MAX(source_updated_at) FROM {{ this }})
{% endif %}

-- schema.yml (excerpt): tests that gate the certified model
--   - name: fct_policy_daily
--     columns:
--       - name: policy_day_key   tests: [unique, not_null]
--       - name: product_key      tests: [relationships: {to: ref('dim_product'), field: product_key}]
--       - name: premium          tests: [dbt_utils.accepted_range: {min_value: 0}]
