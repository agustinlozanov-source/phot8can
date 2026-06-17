'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const createMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  first_name: z.string().min(2, 'Nombre requerido').max(100),
  last_name: z.string().min(2, 'Apellido requerido').max(100),
  role_id: z.string().uuid(),
  temporary_password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const updateMemberSchema = z.object({
  user_id: z.string().uuid(),
  first_name: z.string().min(2).max(100).optional(),
  last_name: z.string().min(2).max(100).optional(),
  role_id: z.string().uuid().optional(),
});

const setActiveSchema = z.object({
  user_id: z.string().uuid(),
  is_active: z.boolean(),
  reason: z.string().max(500).optional(),
});

const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
});

const updateProfileSchema = z.object({
  first_name: z.string().min(2).max(100).optional(),
  last_name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().nullable().optional(),
});

const updatePasswordSchema = z.object({
  current_password: z.string().min(1, 'Indica tu contraseña actual'),
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
});

const ACTIVE_TASK_STATUSES = ['pending', 'in_progress', 'blocked'] as const;

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
    return {
      isSuperAdmin: true as const,
      supabase,
      impersonatingOrgId,
      authUserId: user.id,
      authEmail: user.email ?? null,
    };
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
    authUserId: user.id,
    authEmail: user.email ?? null,
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

type SB = Awaited<ReturnType<typeof createClient>>;

// IDs de roles "Director" de la org
async function getDirectorRoleIds(sb: SB, orgId: string): Promise<string[]> {
  const { data } = await sb
    .from('roles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('name', 'Director');
  return (data || []).map((r) => r.id);
}

// ¿El usuario tiene un rol Director?
async function userIsDirector(
  sb: SB,
  userId: string,
  directorRoleIds: string[]
): Promise<boolean> {
  if (directorRoleIds.length === 0) return false;
  const { data } = await sb
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .in('role_id', directorRoleIds);
  return (data || []).length > 0;
}

// Cuántos Directores activos hay en la org
async function countActiveDirectors(
  sb: SB,
  orgId: string,
  directorRoleIds: string[]
): Promise<number> {
  if (directorRoleIds.length === 0) return 0;
  const { data } = await sb
    .from('user_roles')
    .select('user_id, user:users!user_roles_user_id_fkey(is_active, organization_id)')
    .in('role_id', directorRoleIds);

  const active = new Set<string>();
  for (const row of data || []) {
    const u = row.user as unknown as {
      is_active: boolean;
      organization_id: string;
    } | null;
    if (u?.is_active && u.organization_id === orgId) active.add(row.user_id);
  }
  return active.size;
}

// Reemplaza los roles del usuario por uno solo
async function setUserSingleRole(sb: SB, userId: string, roleId: string) {
  await sb.from('user_roles').delete().eq('user_id', userId);
  return sb.from('user_roles').insert({ user_id: userId, role_id: roleId });
}

// ============================================================
// LISTAR MIEMBROS
// ============================================================

export async function listTeamMembersAction(filters?: {
  is_active?: boolean;
  role_id?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const isActive = filters?.is_active ?? true;

  // Filtro por rol → primero obtener los user_ids con ese rol
  let restrictUserIds: string[] | null = null;
  if (filters?.role_id) {
    const { data: ur } = await ctx.supabase
      .from('user_roles')
      .select('user_id')
      .eq('role_id', filters.role_id);
    restrictUserIds = (ur || []).map((r) => r.user_id);
    if (restrictUserIds.length === 0) return { members: [] };
  }

  let query = ctx.supabase
    .from('users')
    .select(
      `
      id, organization_id, email, first_name, last_name, avatar_url,
      position_title, is_active, last_login_at, created_at,
      user_roles(role:roles(id, name, description, color, is_system))
    `
    )
    .eq('organization_id', orgId)
    .eq('is_active', isActive);

  if (restrictUserIds) query = query.in('id', restrictUserIds);

  const { data: members, error } = await query
    .order('is_active', { ascending: false })
    .order('first_name', { ascending: true });

  if (error) return { error: `Error al cargar el equipo: ${error.message}` };

  // Conteo de tareas activas asignadas
  const userIds = (members || []).map((m) => m.id);
  const taskCounts: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: tasks } = await ctx.supabase
      .from('work_order_tasks')
      .select('assigned_to_user_id')
      .in('assigned_to_user_id', userIds)
      .in('status', ACTIVE_TASK_STATUSES);
    for (const t of tasks || []) {
      if (t.assigned_to_user_id) {
        taskCounts[t.assigned_to_user_id] =
          (taskCounts[t.assigned_to_user_id] || 0) + 1;
      }
    }
  }

  const withStats = (members || []).map((m) => ({
    ...m,
    active_task_count: taskCounts[m.id] || 0,
  }));

  return { members: withStats };
}

// ============================================================
// CREAR MIEMBRO DIRECTO (password temporal)
// ============================================================

export async function createMemberDirectAction(payload: {
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  temporary_password: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = createMemberSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const email = validation.data.email.toLowerCase().trim();

  // Validar rol
  const { data: role } = await ctx.supabase
    .from('roles')
    .select('id, organization_id, is_system')
    .eq('id', validation.data.role_id)
    .maybeSingle();
  if (!role || (role.organization_id !== orgId && !role.is_system)) {
    return { error: 'El rol indicado no es válido para esta organización' };
  }

  // Email no debe existir en la org
  const { data: existing } = await ctx.supabase
    .from('users')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return { error: 'Ya existe un miembro con ese email en la organización' };
  }

  const service = await createServiceClient();

  const { data: authData, error: authError } =
    await service.auth.admin.createUser({
      email,
      password: validation.data.temporary_password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    if (authError?.message.includes('already registered')) {
      return { error: 'Ya existe una cuenta de auth con este email' };
    }
    return { error: `Error al crear cuenta: ${authError?.message}` };
  }

  const { data: newUser, error: userError } = await service
    .from('users')
    .insert({
      organization_id: orgId,
      auth_user_id: authData.user.id,
      email,
      first_name: validation.data.first_name.trim(),
      last_name: validation.data.last_name.trim(),
      is_active: true,
    })
    .select('id')
    .single();

  if (userError || !newUser) {
    await service.auth.admin.deleteUser(authData.user.id);
    return { error: `Error al crear usuario: ${userError?.message}` };
  }

  const { error: roleError } = await service
    .from('user_roles')
    .insert({ user_id: newUser.id, role_id: validation.data.role_id });
  if (roleError) {
    console.error('[createMemberDirect] Error asignando rol:', roleError);
  }

  revalidatePath('/team');
  return { success: true, userId: newUser.id };
}

// ============================================================
// ACTUALIZAR MIEMBRO
// ============================================================

export async function updateMemberAction(payload: {
  user_id: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = updateMemberSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: member } = await ctx.supabase
    .from('users')
    .select('id, organization_id')
    .eq('id', validation.data.user_id)
    .maybeSingle();
  if (!member || member.organization_id !== orgId) {
    return { error: 'Miembro no encontrado' };
  }

  // Cambio de rol
  if (validation.data.role_id) {
    const { data: role } = await ctx.supabase
      .from('roles')
      .select('id, organization_id, is_system')
      .eq('id', validation.data.role_id)
      .maybeSingle();
    if (!role || (role.organization_id !== orgId && !role.is_system)) {
      return { error: 'El rol indicado no es válido para esta organización' };
    }

    // Proteger al último Director
    const directorIds = await getDirectorRoleIds(ctx.supabase, orgId);
    const wasDirector = await userIsDirector(
      ctx.supabase,
      member.id,
      directorIds
    );
    const willBeDirector = directorIds.includes(validation.data.role_id);

    if (wasDirector && !willBeDirector) {
      const activeDirectors = await countActiveDirectors(
        ctx.supabase,
        orgId,
        directorIds
      );
      if (activeDirectors <= 1) {
        return {
          error:
            'No puedes quitar el rol al único Director activo. Asigna otro Director primero.',
        };
      }
    }

    const { error: roleError } = await setUserSingleRole(
      ctx.supabase,
      member.id,
      validation.data.role_id
    );
    if (roleError) {
      return { error: `Error al cambiar el rol: ${roleError.message}` };
    }
  }

  // Cambio de nombre
  const nameUpdate: { first_name?: string; last_name?: string } = {};
  if (validation.data.first_name)
    nameUpdate.first_name = validation.data.first_name.trim();
  if (validation.data.last_name)
    nameUpdate.last_name = validation.data.last_name.trim();

  if (Object.keys(nameUpdate).length > 0) {
    const { error } = await ctx.supabase
      .from('users')
      .update(nameUpdate)
      .eq('id', member.id);
    if (error) return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/team');
  revalidatePath(`/team/${member.id}`);
  return { success: true };
}

// ============================================================
// ACTIVAR / DESACTIVAR MIEMBRO
// ============================================================

export async function setMemberActiveAction(payload: {
  user_id: string;
  is_active: boolean;
  reason?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = setActiveSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // No auto-desactivarse
  if (
    !validation.data.is_active &&
    !ctx.isSuperAdmin &&
    validation.data.user_id === ctx.userId
  ) {
    return { error: 'No puedes desactivarte a ti mismo' };
  }

  const { data: member } = await ctx.supabase
    .from('users')
    .select('id, organization_id')
    .eq('id', validation.data.user_id)
    .maybeSingle();
  if (!member || member.organization_id !== orgId) {
    return { error: 'Miembro no encontrado' };
  }

  // No desactivar al último Director activo
  if (!validation.data.is_active) {
    const directorIds = await getDirectorRoleIds(ctx.supabase, orgId);
    const isDirector = await userIsDirector(
      ctx.supabase,
      member.id,
      directorIds
    );
    if (isDirector) {
      const activeDirectors = await countActiveDirectors(
        ctx.supabase,
        orgId,
        directorIds
      );
      if (activeDirectors <= 1) {
        return {
          error: 'No puedes desactivar al único Director activo.',
        };
      }
    }
  }

  const { error } = await ctx.supabase
    .from('users')
    .update({ is_active: validation.data.is_active })
    .eq('id', member.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/team');
  return { success: true };
}

// ============================================================
// BORRAR MIEMBRO (solo Super Admin)
// ============================================================

export async function deleteMemberAction(userId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return { error: 'Solo un Super Admin puede borrar miembros' };
  }

  const service = await createServiceClient();

  const { data: member } = await service
    .from('users')
    .select('id, auth_user_id')
    .eq('id', userId)
    .maybeSingle();
  if (!member) return { error: 'Miembro no encontrado' };

  const { error: delError } = await service
    .from('users')
    .delete()
    .eq('id', userId);
  if (delError) return { error: `Error al borrar usuario: ${delError.message}` };

  if (member.auth_user_id) {
    const { error: authError } = await service.auth.admin.deleteUser(
      member.auth_user_id
    );
    if (authError) {
      console.error('[deleteMember] Error borrando auth user:', authError);
    }
  }

  revalidatePath('/team');
  return { success: true };
}

// ============================================================
// RESETEAR PASSWORD DE UN MIEMBRO
// ============================================================

export async function resetMemberPasswordAction(payload: {
  user_id: string;
  new_password: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('team.manage'))) {
    return { error: 'No tienes permiso para gestionar el equipo' };
  }

  const validation = resetPasswordSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: member } = await ctx.supabase
    .from('users')
    .select('id, organization_id, auth_user_id')
    .eq('id', validation.data.user_id)
    .maybeSingle();
  if (!member || member.organization_id !== orgId) {
    return { error: 'Miembro no encontrado' };
  }
  if (!member.auth_user_id) {
    return { error: 'Este miembro no tiene cuenta de acceso' };
  }

  const service = await createServiceClient();
  const { error } = await service.auth.admin.updateUserById(
    member.auth_user_id,
    { password: validation.data.new_password }
  );

  if (error) return { error: `Error al resetear contraseña: ${error.message}` };

  return { success: true };
}

// ============================================================
// PERFIL PROPIO
// ============================================================

export async function getCurrentProfileAction() {
  const { getActiveContext } = await import('@/lib/auth/context');
  const authCtx = await getActiveContext();

  if (authCtx.mode === 'none') return { error: 'No autenticado' };
  if (!authCtx.user) {
    // Super admin sin registro en users
    return {
      user: null,
      roles: [],
      permissions: Array.from(authCtx.permissions),
      isSuperAdmin: authCtx.isSuperAdmin,
    };
  }

  const supabase = await createClient();
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role:roles(id, name, description, color)')
    .eq('user_id', authCtx.user.id);

  return {
    user: authCtx.user,
    roles: (roles || []).map((r) => r.role),
    permissions: Array.from(authCtx.permissions),
    isSuperAdmin: authCtx.isSuperAdmin,
  };
}

export async function updateMyProfileAction(payload: {
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (ctx.isSuperAdmin || !ctx.userId) {
    return { error: 'Tu perfil no es editable desde aquí' };
  }

  const validation = updateProfileSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const update: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
  } = {};
  if (validation.data.first_name)
    update.first_name = validation.data.first_name.trim();
  if (validation.data.last_name)
    update.last_name = validation.data.last_name.trim();
  if (validation.data.avatar_url !== undefined)
    update.avatar_url = validation.data.avatar_url;

  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('users')
    .update(update)
    .eq('id', ctx.userId);

  if (error) return { error: `Error al actualizar perfil: ${error.message}` };

  revalidatePath('/profile');
  revalidatePath('/team');
  return { success: true };
}

export async function updateMyPasswordAction(payload: {
  current_password: string;
  new_password: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };
  if (!ctx.authEmail) return { error: 'No se pudo determinar tu cuenta' };

  const validation = updatePasswordSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Verificar la contraseña actual con un cliente de servicio (no toca cookies)
  const verifier = await createServiceClient();
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: ctx.authEmail,
    password: validation.data.current_password,
  });
  if (signInError) {
    return { error: 'La contraseña actual es incorrecta' };
  }

  // Cambiar la contraseña vía admin
  const { error } = await verifier.auth.admin.updateUserById(ctx.authUserId, {
    password: validation.data.new_password,
  });
  if (error) return { error: `Error al cambiar contraseña: ${error.message}` };

  return { success: true };
}
