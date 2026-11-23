-- Nexus (Lifepal) · Bronze → Silver from Kafka + Debezium change events · newest record wins
-- Databricks SQL on Delta Lake. Written for this portfolio to show the pattern I used;
-- not Lifepal's production code.

-- Bronze: raw Debezium envelopes, replayable, never updated in place
CREATE TABLE IF NOT EXISTS bronze.policy_cdc (
  kafka_topic     STRING,
  kafka_partition INT,
  kafka_offset    BIGINT,
  op              STRING,          -- c = create, u = update, d = delete, r = snapshot read
  ts_ms           BIGINT,          -- source commit time
  lsn             BIGINT,          -- PostgreSQL log sequence number: the true order
  after           STRING,          -- JSON row image after the change
  before          STRING,
  _loaded_at      TIMESTAMP
) USING DELTA;

-- Silver: current state, one row per policy, typed and deduplicated
MERGE INTO silver.policy AS t
USING (
  SELECT * FROM (
    SELECT
      CAST(get_json_object(COALESCE(after, before), '$.policy_id') AS BIGINT) AS policy_id,
      get_json_object(after, '$.status')                                AS status,
      CAST(get_json_object(after, '$.premium') AS DECIMAL(14,2))        AS premium,
      op, lsn, ts_ms,
      ROW_NUMBER() OVER (PARTITION BY get_json_object(COALESCE(after, before), '$.policy_id')
                         ORDER BY lsn DESC, kafka_offset DESC) AS rn     -- replays and retries collapse here
    FROM bronze.policy_cdc
    WHERE _loaded_at > (SELECT COALESCE(MAX(_source_loaded_at), '1970-01-01') FROM silver.policy)
  ) WHERE rn = 1
) AS s
ON t.policy_id = s.policy_id
WHEN MATCHED AND s.op = 'd'          THEN DELETE
WHEN MATCHED AND s.lsn > t._lsn      THEN UPDATE SET            -- never let an older event overwrite a newer one
  status = s.status, premium = s.premium, _lsn = s.lsn, _source_ts = timestamp_millis(s.ts_ms),
  _source_loaded_at = current_timestamp()
WHEN NOT MATCHED AND s.op <> 'd'     THEN INSERT
  (policy_id, status, premium, _lsn, _source_ts, _source_loaded_at)
  VALUES (s.policy_id, s.status, s.premium, s.lsn, timestamp_millis(s.ts_ms), current_timestamp());
