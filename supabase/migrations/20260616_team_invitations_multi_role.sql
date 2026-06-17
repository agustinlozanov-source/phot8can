-- ============================================================
-- Módulo 08 Equipo — Soporte de MÚLTIPLES roles por invitación
-- ============================================================
-- ESTADO: PENDIENTE DE APLICAR. No ejecutar hasta decidir el enfoque.
--
-- Hoy `team_invitations.intended_role_id` es una sola columna (FK a roles),
-- por eso `createInvitationAction` limita temporalmente a 1 rol por invitación.
-- Esta migración habilita N roles. Elige UNA de las dos opciones.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- OPCIÓN A (RECOMENDADA) — Tabla junction team_invitation_roles
-- ════════════════════════════════════════════════════════════
-- Ventajas: integridad referencial real por rol (FK + ON DELETE CASCADE),
-- consistente con cómo ya modelamos user_roles / role_permissions.

CREATE TABLE IF NOT EXISTS team_invitation_roles (
  invitation_id uuid NOT NULL REFERENCES team_invitations(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (invitation_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_team_invitation_roles_invitation
  ON team_invitation_roles (invitation_id);

-- Backfill: copiar el rol único actual a la nueva junction
INSERT INTO team_invitation_roles (invitation_id, role_id)
SELECT id, intended_role_id
FROM team_invitations
WHERE intended_role_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Una vez verificado el backfill y migrado el código, opcionalmente:
-- ALTER TABLE team_invitations ALTER COLUMN intended_role_id DROP NOT NULL;
-- (o conservarla como "rol principal" para compatibilidad.)

-- RLS: replicar las políticas de team_invitations a la junction según
-- el modelo de seguridad del proyecto (acceso por organización).


-- ════════════════════════════════════════════════════════════
-- OPCIÓN B (ALTERNATIVA) — Columna array uuid[]
-- ════════════════════════════════════════════════════════════
-- Más simple pero sin FK por rol (no hay ON DELETE CASCADE si se borra un rol).
-- Si se elige esta, NO aplicar la Opción A.
--
-- ALTER TABLE team_invitations
--   ADD COLUMN intended_role_ids uuid[] NOT NULL DEFAULT '{}';
--
-- -- Backfill desde la columna única:
-- UPDATE team_invitations
--   SET intended_role_ids = ARRAY[intended_role_id]
--   WHERE intended_role_id IS NOT NULL;
--
-- -- Luego (cuando el código ya no use la columna vieja):
-- ALTER TABLE team_invitations DROP COLUMN intended_role_id;


-- ════════════════════════════════════════════════════════════
-- DESPUÉS DE APLICAR (cualquiera de las dos)
-- ════════════════════════════════════════════════════════════
-- 1. Actualizar el tipo en lib/types/database.ts (quitar intended_role_id
--    o agregar intended_role_ids / la relación a team_invitation_roles).
-- 2. En createInvitationAction: quitar la validación temporal
--    "Por ahora solo se soporta 1 rol por invitación" y persistir todos
--    los intended_role_ids (ver TODO en el código).
-- 3. En acceptInvitationPublicAction: insertar en user_roles un registro
--    por cada rol de la invitación (hoy inserta solo intended_role_id).
