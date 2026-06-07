'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================

const createInvitationSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email('Email inválido'),
  firstName: z.string().min(1, 'Nombre requerido').max(100),
  lastName: z.string().min(1, 'Apellido requerido').max(100),
  roleIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un rol'),
});

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número');

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

// ============================================================
// CREAR INVITACIÓN
// ============================================================

export async function createInvitation(formData: FormData) {
  const supabase = await createClient();

  // Verificar que el usuario actual sea super admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!superAdmin) {
    return { error: 'Solo super admins pueden crear invitaciones desde aquí' };
  }

  // Parsear datos
  const rawData = {
    organizationId: formData.get('organizationId') as string,
    email: (formData.get('email') as string)?.toLowerCase().trim(),
    firstName: (formData.get('firstName') as string)?.trim(),
    lastName: (formData.get('lastName') as string)?.trim(),
    roleIds: formData.getAll('roleIds') as string[],
  };

  // Validar
  const validation = createInvitationSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const data = validation.data;

  // Verificar que no exista ya un usuario con ese email en esa org
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', data.organizationId)
    .eq('email', data.email)
    .maybeSingle();

  if (existingUser) {
    return { error: 'Ya existe un usuario con ese email en esta organización' };
  }

  // Verificar que no exista invitación pendiente
  const { data: existingInvitation } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', data.organizationId)
    .eq('email', data.email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvitation) {
    return {
      error: 'Ya existe una invitación pendiente para ese email. Cancélala primero si quieres crear una nueva.',
    };
  }

  // Crear la invitación
  const { data: invitation, error: insertError } = await supabase
    .from('invitations')
    .insert({
      organization_id: data.organizationId,
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      roles_to_assign: data.roleIds,
    })
    .select('id, token')
    .single();

  if (insertError) {
    return { error: `Error al crear invitación: ${insertError.message}` };
  }

  revalidatePath(`/admin/organizations/${data.organizationId}`);

  return {
    success: true,
    invitationId: invitation.id,
    token: invitation.token,
  };
}

// ============================================================
// CANCELAR INVITACIÓN
// ============================================================

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!superAdmin) {
    return { error: 'Permiso denegado' };
  }

  // Obtener org id para revalidate
  const { data: invitation } = await supabase
    .from('invitations')
    .select('organization_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) {
    return { error: 'Invitación no encontrada' };
  }

  const { error: deleteError } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (deleteError) {
    return { error: `Error al cancelar: ${deleteError.message}` };
  }

  revalidatePath(`/admin/organizations/${invitation.organization_id}`);
  return { success: true };
}

// ============================================================
// VALIDAR TOKEN DE INVITACIÓN (público)
// ============================================================

export async function getInvitationByToken(token: string) {
  // Usamos service client porque esta función es pública (sin auth)
  const supabase = await createServiceClient();

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, email, first_name, last_name, organization_id, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !invitation) {
    return { error: 'Invitación no encontrada' };
  }

  if (invitation.accepted_at) {
    return { error: 'Esta invitación ya fue aceptada' };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { error: 'Esta invitación ha expirado' };
  }

  // Obtener nombre de la organización
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', invitation.organization_id)
    .maybeSingle();

  return {
    success: true,
    invitation: {
      ...invitation,
      organizationName: org?.name || 'Organización',
    },
  };
}

// ============================================================
// ACEPTAR INVITACIÓN
// ============================================================

export async function acceptInvitation(formData: FormData) {
  // Usamos service client porque el invitado aún no tiene auth
  const supabase = await createServiceClient();

  const rawData = {
    token: formData.get('token') as string,
    password: formData.get('password') as string,
  };

  const validation = acceptInvitationSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Validar invitación
  const { data: invitation, error: invError } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', validation.data.token)
    .maybeSingle();

  if (invError || !invitation) {
    return { error: 'Invitación no encontrada' };
  }

  if (invitation.accepted_at) {
    return { error: 'Esta invitación ya fue aceptada' };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { error: 'Esta invitación ha expirado' };
  }

  // Crear cuenta en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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

  // Crear registro en users
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      organization_id: invitation.organization_id,
      auth_user_id: authData.user.id,
      email: invitation.email,
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      is_active: true,
    })
    .select('id')
    .single();

  if (userError || !newUser) {
    // Rollback: eliminar el auth user creado
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: `Error al crear usuario: ${userError?.message}` };
  }

  // Asignar roles
  if (invitation.roles_to_assign && invitation.roles_to_assign.length > 0) {
    const roleAssignments = invitation.roles_to_assign.map((roleId: string) => ({
      user_id: newUser.id,
      role_id: roleId,
    }));

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert(roleAssignments);

    if (roleError) {
      console.error('Error asignando roles:', roleError);
      // No hacemos rollback aquí, el usuario ya está creado
      // Se pueden asignar manualmente después
    }
  }

  // Marcar invitación como aceptada
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return { success: true };
}
