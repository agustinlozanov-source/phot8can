-- ============================================================
-- Módulo 14 Conversaciones — Webhook por organización (Zernio)
-- ============================================================
-- Cada org tiene su propio webhook en Zernio con su secret (mejor aislamiento).
-- Aplicar manualmente en el Supabase Dashboard.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS zernio_webhook_id text,
  ADD COLUMN IF NOT EXISTS zernio_webhook_secret text;
