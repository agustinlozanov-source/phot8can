-- ============================================================
-- Módulo 14 Conversaciones — zernio_conversation_id en conversations
-- ============================================================
-- ID de la conversación en Zernio. Necesario para enviar mensajes salientes.
-- Aplicar manualmente en el Supabase Dashboard.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS zernio_conversation_id text;

CREATE INDEX IF NOT EXISTS idx_conversations_zernio_conversation_id
  ON conversations (zernio_conversation_id)
  WHERE zernio_conversation_id IS NOT NULL;
