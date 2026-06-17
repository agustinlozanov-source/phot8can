'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { TeamInvitationStatus } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const createInvitationSchema = z.object({
  email: z.string().email('Email inválido'),
  intended_role_id: z.string().uuid(),
  intended_first_name: z.string().max(100).optional(),
  intended_last_name: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

const cancelInvitationSchema = z.object({
  invitation_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  first_name: z.string().min(2, 'Nombre requerido').max(100),
  last_name: z.string().min(2, 'Apellido requerido').max(100),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

// ============================================================
// HELPERS
// ============================================================

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' as const };

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    const { getImpersonatedOrganizationId } = await import(
      '@/lib/actions/impersonation'
    );
    const impersonatingOrgId = await getImpersonatedOrganizationId();
    return { isSuperAdmin: true as const, supabase, impersonatingOrgId };
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) return { error: 'Usuario no encontrado' as const };

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}

// ============================================================
// CREAR INVITACIÓN
// ============================================================

export async function createInvitationAction(payload: {
  email: string;
  intended_role_id: string;
  intended_first_name?: string;
  intended_last_name?: string;
  message?: string;
  expires_in_days?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = createInvitationSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const email = validation.data.email.toLowerCase().trim();

  // El rol debe existir y pertenecer a la org (los roles base también tienen org)
  const { data: role } = await ctx.supabase
    .from('roles')
    .select('id, organization_id, is_system')
    .eq('id', validation.data.intended_role_id)
    .maybeSingle();

  if (!role || (role.organization_id !== orgId && !role.is_system)) {
    return { error: 'El rol indicado no es válido para esta organización' };
  }

  // El email no debe ser un usuario activo de la org
  const { data: existingUser } = await ctx.supabase
    .from('users')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (existingUser) {
    return { error: 'Ya existe un miembro activo con ese email' };
  }

  // No debe haber una invitación pendiente para ese email
  const { data: pending } = await ctx.supabase
    .from('team_invitations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending) {
    return {
      error:
        'Ya existe una invitación pendiente para ese email. Cancélala primero o reenvía el link.',
    };
  }

  // Token
  const { data: token, error: tokenError } = await ctx.supabase.rpc(
    'generate_share_token'
  );
  if (tokenError || !token) {
    return { error: 'No se pudo generar el token de invitación' };
  }

  const expiresAt = new Date(
    Date.now() + validation.data.expires_in_days * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error: insertError } = await ctx.supabase
    .from('team_invitations')
    .insert({
      organization_id: orgId,
      email,
      intended_first_name: validation.data.intended_first_name?.trim() || null,
      intended_last_name: validation.data.intended_last_name?.trim() || null,
      intended_role_id: validation.data.intended_role_id,
      invitation_token: token as string,
      status: 'pending',
      message: validation.data.message?.trim() || null,
      expires_at: expiresAt,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, invitation_token')
    .single();

  if (insertError || !invitation) {
    return { error: `Error al crear invitación: ${insertError?.message}` };
  }

  revalidatePath('/team');
  revalidatePath('/team/invitations');

  return {
    success: true,
    invitationId: invitation.id,
    token: invitation.invitation_token,
  };
}

// ============================================================
// CANCELAR INVITACIÓN
// ============================================================

export async function cancelInvitationAction(payload: {
  invitation_id: string;
  reason?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = cancelInvitationSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: invitation } = await ctx.supabase
    .from('team_invitations')
    .select('id, status, organization_id')
    .eq('id', validation.data.invitation_id)
    .maybeSingle();

  if (!invitation || invitation.organization_id !== orgId) {
    return { error: 'Invitación no encontrada' };
  }
  if (invitation.status !== 'pending') {
    return { error: 'Solo se pueden cancelar invitaciones pendientes' };
  }

  const { error } = await ctx.supabase
    .from('team_invitations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: ctx.isSuperAdmin ? null : ctx.userId,
      cancellation_reason: validation.data.reason?.trim() || null,
    })
    .eq('id', invitation.id);

  if (error) return { error: `Error al cancelar: ${error.message}` };

  revalidatePath('/team');
  revalidatePath('/team/invitations');
  return { success: true };
}

// ============================================================
// REGENERAR TOKEN DE INVITACIÓN
// ============================================================

export async function regenerateInvitationTokenAction(invitationId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: invitation } = await ctx.supabase
    .from('team_invitations')
    .select('id, status, organization_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation || invitation.organization_id !== orgId) {
    return { error: 'Invitación no encontrada' };
  }
  if (invitation.status !== 'pending') {
    return { error: 'Solo se pueden regenerar invitaciones pendientes' };
  }

  const { data: token, error: tokenError } = await ctx.supabase.rpc(
    'generate_share_token'
  );
  if (tokenError || !token) {
    return { error: 'No se pudo generar el nuevo token' };
  }

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await ctx.supabase
    .from('team_invitations')
    .update({ invitation_token: token as string, expires_at: expiresAt })
    .eq('id', invitation.id);

  if (error) return { error: `Error al regenerar: ${error.message}` };

  revalidatePath('/team/invitations');
  return { success: true, token: token as string };
}

// ============================================================
// EXPIRAR INVITACIONES VENCIDAS (batch)
// ============================================================

export async function expireOldInvitationsAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { error } = await ctx.supabase
    .from('team_invitations')
    .update({ status: 'expired' })
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (error) return { error: error.message };
  return { success: true };
}

// ============================================================
// LISTAR INVITACIONES
// ============================================================

export async function listInvitationsAction(filters?: {
  status?: TeamInvitationStatus | 'all';
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // Marcar como expiradas las vencidas antes de listar
  await ctx.supabase
    .from('team_invitations')
    .update({ status: 'expired' })
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  let query = ctx.supabase
    .from('team_invitations')
    .select(
      `
      *,
      intended_role:roles!team_invitations_intended_role_id_fkey(id, name, description),
      creator:users!team_invitations_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('organization_id', orgId);

  const status = filters?.status ?? 'pending';
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) return { error: `Error al cargar invitaciones: ${error.message}` };

  return { invitations: data || [] };
}

// ============================================================
// PÚBLICO: OBTENER INVITACIÓN POR TOKEN
// ============================================================

export async function getInvitationByTokenPublicAction(token: string) {
  const supabase = await createServiceClient();

  const { data: invitation } = await supabase
    .from('team_invitations')
    .select(
      `
      id, email, intended_first_name, intended_last_name, status, message,
      expires_at, organization_id, intended_role_id,
      intended_role:roles!team_invitations_intended_role_id_fkey(name)
    `
    )
    .eq('invitation_token', token)
    .maybeSingle();

  if (!invitation) return { error: 'Invitación no encontrada' };

  if (invitation.status === 'accepted') {
    return { error: 'Esta invitación ya fue aceptada' };
  }
  if (invitation.status === 'cancelled') {
    return { error: 'Esta invitación fue cancelada' };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Auto-marcar como expirada
    if (invitation.status === 'pending') {
      await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
    }
    return { error: 'Esta invitación ha expirado' };
  }

  if (invitation.status !== 'pending') {
    return { error: 'Esta invitación ya no está disponible' };
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url')
    .eq('id', invitation.organization_id)
    .maybeSingle();

  const role = invitation.intended_role as unknown as { name: string } | null;

  return {
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      intended_first_name: invitation.intended_first_name,
      intended_last_name: invitation.intended_last_name,
      message: invitation.message,
      role_name: role?.name ?? null,
      organization_name: org?.name ?? 'Organización',
      organization_logo_url: org?.logo_url ?? null,
    },
  };
}

// ============================================================
// PÚBLICO: ACEPTAR INVITACIÓN
// ============================================================

export async function acceptInvitationPublicAction(payload: {
  token: string;
  first_name: string;
  last_name: string;
  password: string;
}) {
  const validation = acceptInvitationSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const supabase = await createServiceClient();

  const { data: invitation } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('invitation_token', validation.data.token)
    .maybeSingle();

  if (!invitation) return { error: 'Invitación no encontrada' };
  if (invitation.status !== 'pending') {
    return { error: 'Esta invitación ya no está disponible' };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from('team_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);
    return { error: 'Esta invitación ha expirado' };
  }

  // 1. Crear cuenta de auth
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: invitation.email,
      password: validation.data.password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    if (authError?.message.includes('already registered')) {
      return {
        error: 'Ya existe una cuenta con este email. Contacta al administrador.',
      };
    }
    return { error: `Error al crear cuenta: ${authError?.message}` };
  }

  // 2. Crear el registro de usuario
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      organization_id: invitation.organization_id,
      auth_user_id: authData.user.id,
      email: invitation.email,
      first_name: validation.data.first_name.trim(),
      last_name: validation.data.last_name.trim(),
      is_active: true,
    })
    .select('id')
    .single();

  if (userError || !newUser) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: `Error al crear usuario: ${userError?.message}` };
  }

  // 3. Asignar el rol previsto
  const { error: roleError } = await supabase.from('user_roles').insert({
    user_id: newUser.id,
    role_id: invitation.intended_role_id,
  });

  if (roleError) {
    console.error('[acceptInvitation] Error asignando rol:', roleError);
  }

  // 4. Marcar invitación como aceptada
  await supabase
    .from('team_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: newUser.id,
    })
    .eq('id', invitation.id);

  return { success: true };
}
