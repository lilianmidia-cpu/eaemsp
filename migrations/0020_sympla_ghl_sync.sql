-- Sympla -> GHL tag sync. Tracks the last known order_status per Sympla
-- order so the sync only calls the GHL API when a contact's status group
-- actually changes, plus a single-row watermark so each hourly run only
-- pages through orders updated since the last successful run.
CREATE TABLE IF NOT EXISTS sympla_ghl_sync (
    order_id       TEXT PRIMARY KEY,
    event_id       TEXT NOT NULL,
    buyer_email    TEXT NOT NULL,
    order_status   TEXT NOT NULL,      -- last Sympla order_status synced
    ghl_contact_id TEXT,
    synced_at      INTEGER NOT NULL    -- unix seconds
);

CREATE INDEX IF NOT EXISTS idx_sympla_ghl_sync_status ON sympla_ghl_sync(order_status);

CREATE TABLE IF NOT EXISTS sympla_sync_state (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    last_watermark TEXT,               -- max Sympla updated_date processed so far
    updated_at     INTEGER NOT NULL    -- unix seconds
);
