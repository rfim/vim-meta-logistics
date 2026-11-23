-- Toast · inventory and supplier ERP · every change traced to who made it and when
-- PostgreSQL. Written for this portfolio to show the pattern; not Toast's production schema.

CREATE TABLE supplier (
  supplier_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text        NOT NULL,
  country       char(2)     NOT NULL,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product (
  product_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku           text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  category      text        NOT NULL,
  supplier_id   bigint      NOT NULL REFERENCES supplier,
  unit_price    numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One append-only table for every change, written by a trigger so no code path can skip it.
CREATE TABLE audit_event (
  event_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name    text        NOT NULL,
  row_id        bigint      NOT NULL,
  action        text        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by    text        NOT NULL,           -- app user, or the AI assistant's own role
  changed_at    timestamptz NOT NULL DEFAULT now(),
  before        jsonb,
  after         jsonb,
  approved_by   text                            -- a person, for every AI-originated change
);
REVOKE UPDATE, DELETE ON audit_event FROM PUBLIC;  -- append-only

CREATE OR REPLACE FUNCTION write_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_event (table_name, row_id, action, changed_by, before, after, approved_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW) ->> (TG_ARGV[0]))::bigint, (to_jsonb(OLD) ->> (TG_ARGV[0]))::bigint),
    TG_OP,
    current_setting('app.user', true),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    current_setting('app.approved_by', true)
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER audit_supplier AFTER INSERT OR UPDATE OR DELETE ON supplier
  FOR EACH ROW EXECUTE FUNCTION write_audit('supplier_id');
CREATE TRIGGER audit_product  AFTER INSERT OR UPDATE OR DELETE ON product
  FOR EACH ROW EXECUTE FUNCTION write_audit('product_id');

-- Guardrail: an AI assistant's change is rejected unless a person approved it.
CREATE OR REPLACE FUNCTION require_human_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.user', true) LIKE 'assistant:%'
     AND coalesce(current_setting('app.approved_by', true), '') = '' THEN
    RAISE EXCEPTION 'AI change to % needs a human approver', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER human_gate_product BEFORE INSERT OR UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION require_human_approval();

-- "Who touched it last, and what changed?"
SELECT e.changed_at, e.changed_by, e.approved_by, e.action,
       e.before ->> 'unit_price' AS price_before, e.after ->> 'unit_price' AS price_after
FROM   audit_event e
WHERE  e.table_name = 'product' AND e.row_id = :product_id
ORDER  BY e.changed_at DESC
LIMIT  10;
