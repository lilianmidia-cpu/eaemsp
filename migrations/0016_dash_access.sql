-- Registra cada acesso ao painel (dashboard) para a aba "Acessos"
CREATE TABLE IF NOT EXISTS dash_access (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  accessed_at  INTEGER NOT NULL,             -- epoch seconds
  path         TEXT NOT NULL,                -- ex: /painel, /painel/financeiro
  ip_address   TEXT,
  country      TEXT,                         -- cf-ipcountry (BR, US, ...)
  city         TEXT,                         -- cf-ipcity quando disponível
  region       TEXT,                         -- cf-region (estado/UF)
  user_agent   TEXT,
  referrer     TEXT,
  is_logged_in INTEGER NOT NULL DEFAULT 0    -- 1 se passou pelo login com senha
);

CREATE INDEX IF NOT EXISTS idx_dash_access_time ON dash_access(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dash_access_path ON dash_access(path);
