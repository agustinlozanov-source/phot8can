'use server';

import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Correo y contraseña son requeridos.' };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    // Traducir errores comunes de Supabase
    if (authError.message.includes('Invalid login credentials')) {
      return { error: 'Correo o contraseña incorrectos.' };
    }
    if (authError.message.includes('Email not confirmed')) {
      return { error: 'Tu correo no ha sido confirmado.' };
    }
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'No se pudo iniciar sesión.' };
  }

  // Determinar a dónde redirigir según el tipo de usuario
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    // Actualizar last_login_at
    await supabase
      .from('super_admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', superAdmin.id);

    return { redirectTo: '/admin' };
  }

  // Buscar como usuario regular
  const { data: user } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', authData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (user) {
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    return { redirectTo: '/dashboard' };
  }

  // No es ni super admin ni usuario regular
  await supabase.auth.signOut();
  return {
    error:
      'Tu cuenta de autenticación existe pero no está vinculada a ningún rol del sistema. Contacta al administrador.',
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}
