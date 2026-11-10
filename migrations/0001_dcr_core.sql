CREATE TABLE app_staff (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending','cashier','accounting','admin')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dcrs (
  id BIGSERIAL PRIMARY KEY,
  dcr_no TEXT NOT NULL UNIQUE,
  date_covered DATE NOT NULL,
  prepared_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  beginning_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2),
  pdc_balance_at_closing NUMERIC(14,2),
  tieout_at_closing NUMERIC(14,2),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dcrs_date ON dcrs(date_covered DESC);

CREATE TABLE dcr_transactions (
  id BIGSERIAL PRIMARY KEY,
  client_ref TEXT NOT NULL UNIQUE,
  dcr_id BIGINT NOT NULL REFERENCES dcrs(id),
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('cash_remittance','check_remittance','check_payment','check_encashment','pdc_received','pdc_deposit','cash_deposit','adjustment')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payor TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '',
  check_no TEXT NOT NULL DEFAULT '',
  ar_no TEXT NOT NULL DEFAULT '',
  reference_no TEXT NOT NULL DEFAULT '',
  due_date DATE,
  remarks TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by TEXT
);
CREATE INDEX idx_dcr_tx_dcr ON dcr_transactions(dcr_id, transaction_date DESC);
CREATE INDEX idx_dcr_tx_type ON dcr_transactions(transaction_type);
CREATE INDEX idx_dcr_tx_check ON dcr_transactions(bank, check_no);

CREATE TABLE pdc_register (
  id BIGSERIAL PRIMARY KEY,
  bank TEXT NOT NULL,
  check_no TEXT NOT NULL,
  payor TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  received_dcr_id BIGINT REFERENCES dcrs(id),
  received_transaction_id BIGINT REFERENCES dcr_transactions(id),
  check_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Undeposited' CHECK (status IN ('Undeposited','Deposited','Bounced','Cancelled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bank, check_no)
);

CREATE TABLE audit_trail (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_trail(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_trail(created_at DESC);