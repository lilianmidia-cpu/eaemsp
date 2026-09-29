-- Status da venda depois da aprovação (reembolso, chargeback, cancelamento).
-- Toda linha nasce 'approved' (o webhook só insere compra aprovada); os eventos
-- PURCHASE_REFUNDED / PURCHASE_CHARGEBACK / PURCHASE_CANCELED da Hotmart
-- atualizam a linha existente pelo transaction_id, sem apagar nada.
ALTER TABLE purchase_log ADD COLUMN status TEXT DEFAULT 'approved';
ALTER TABLE purchase_log ADD COLUMN status_updated_at INTEGER;
