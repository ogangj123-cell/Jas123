ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS legacy_id text UNIQUE;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS prev_day_collection numeric NOT NULL DEFAULT 0;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS coins numeric NOT NULL DEFAULT 0;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS coins_retained numeric NOT NULL DEFAULT 0;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS check_encashment numeric NOT NULL DEFAULT 0;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS check_payments numeric NOT NULL DEFAULT 0;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS pdc_tieout_per_dcr numeric;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS pdc_tieout_diff numeric;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS total_collection numeric;
ALTER TABLE dcrs ADD COLUMN IF NOT EXISTS total_deposit numeric;
ALTER TABLE pdc_register ADD COLUMN IF NOT EXISTS legacy_id text UNIQUE;
ALTER TABLE pdc_register ADD COLUMN IF NOT EXISTS reg_date date;
ALTER TABLE pdc_register ADD COLUMN IF NOT EXISTS ar_no text NOT NULL DEFAULT '';
ALTER TABLE pdc_register ADD COLUMN IF NOT EXISTS date_deposited date;
ALTER TABLE pdc_register ADD COLUMN IF NOT EXISTS remarks text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS dcr_collections (
 id bigserial PRIMARY KEY, legacy_id text UNIQUE, dcr_id bigint NOT NULL REFERENCES dcrs(id),
 je_no text, payor text NOT NULL DEFAULT '', cash numeric NOT NULL DEFAULT 0,
 chk numeric NOT NULL DEFAULT 0, remarks text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS dcr_pdc_entries (
 id bigserial PRIMARY KEY, legacy_id text UNIQUE, dcr_id bigint NOT NULL REFERENCES dcrs(id),
 check_date date, bank text NOT NULL DEFAULT '', check_no text NOT NULL DEFAULT '',
 amount numeric NOT NULL DEFAULT 0, payor text NOT NULL DEFAULT '', teller text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS dcr_deposits (
 id bigserial PRIMARY KEY, legacy_id text UNIQUE, dcr_id bigint NOT NULL REFERENCES dcrs(id),
 kind text NOT NULL DEFAULT '', bank_account text NOT NULL DEFAULT '', amount numeric NOT NULL DEFAULT 0,
 ref_no text NOT NULL DEFAULT '', remarks text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS dcr_cash_counts (
 id bigserial PRIMARY KEY, legacy_id text UNIQUE, dcr_id bigint NOT NULL REFERENCES dcrs(id),
 denom numeric NOT NULL DEFAULT 0, pieces integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS dcr_import_batches (
 source_key text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(),
 counts jsonb NOT NULL DEFAULT '{}'::jsonb
);