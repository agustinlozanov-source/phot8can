-- ============================================================
-- Módulo 14 Conversaciones — zernio_profile_id en organizations
-- ============================================================
-- Guarda el profile de Zernio asociado a cada organización.
-- Aplicar manualmente en el Supabase Dashboard.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS zernio_profile_id text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_zernio_profile_id_idx
  ON organizations (zernio_profile_id)
  WHERE zernio_profile_id IS NOT NULL;
