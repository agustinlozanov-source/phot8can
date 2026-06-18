-- ============================================================
-- Módulo 14 Conversaciones — Idempotencia/audit de webhooks Zernio
-- ============================================================
-- event_id = payload.id del webhook (también header X-Zernio-Event-Id).
-- Aplicar manualmente en el Supabase Dashboard.

CREATE TABLE IF NOT EXISTS zernio_webhook_events (
  event_id text PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_organization
  ON zernio_webhook_events (organization_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON zernio_webhook_events (received_at DESC);
