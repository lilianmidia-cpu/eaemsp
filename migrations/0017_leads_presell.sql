-- Leads capturados em /vendaspre antes do redirect para o Sympla
CREATE TABLE IF NOT EXISTS leads_presell (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      INTEGER NOT NULL,           -- epoch seconds
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  ticket_choice   TEXT,                       -- ex: "lote-1", "lote-2", "vip"
  session_id      TEXT,                       -- _krob_sid do visitante
  fbp             TEXT,
  fbc             TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  ghl_status      TEXT,                       -- 'sent' | 'failed' | 'skipped'
  ghl_response    TEXT,                       -- corpo da resposta do GHL (debug)
  redirected_to   TEXT                        -- URL Sympla pra qual mandamos
);

CREATE INDEX IF NOT EXISTS idx_leads_presell_time  ON leads_presell(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_presell_email ON leads_presell(email);
