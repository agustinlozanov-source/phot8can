'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const IMPERSONATION_COOKIE = 'photocan_impersonating_org';

/**
 * Permite a un Super Admin "entrar" a una organización
 * y operarla como si fuera un Director.
 *
 * NO da permisos adicionales (el Super Admin ya tiene acceso total por RLS).
 * Solo configura el contexto para que la UI operativa se comporte como
 * si estuviera dentro de esa organización.
 */
export async function enterOrganization(organizationId: string) {
  const supabase = await createClient();

  // Verificar que sea Super Admin
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
    return { error: 'Solo Super Admins pueden entrar a una organización' };
  }

  // Verificar que la organización exista
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .maybeSingle();

  if (!org) {
    return { error: 'Organización no encontrada' };
  }

  // Setear cookie httpOnly
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  });

  return { success: true, organizationName: org.name };
}

/**
 * Salir del modo impersonation.
 * El Super Admin vuelve a su panel /admin.
 */
export async function exitOrganization() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  return { success: true };
}

/**
 * Helper sincrónico para leer la cookie de impersonation.
 * Solo usar desde Server Components / Server Actions.
 */
export async function getImpersonatedOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IMPERSONATION_COOKIE);
  return cookie?.value || null;
}
