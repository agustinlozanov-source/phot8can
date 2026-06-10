'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================

const addressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zip: z.string().optional(),
  })
  .optional()
  .nullable();

const createClientSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  legal_name: z.string().max(200).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  address: addressSchema,
  acquisition_source: z.string().max(200).optional().nullable(),
  notes: z.string().optional().nullable(),
  account_manager_id: z.string().uuid().optional().nullable(),
});

const updateClientSchema = createClientSchema.extend({
  id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'churned']).optional(),
});

const createContactSchema = z.object({
  client_id: z.string().uuid(),
  first_name: z.string().min(1, 'Nombre requerido').max(100),
  last_name: z.string().min(1, 'Apellido requerido').max(100),
  email: z.string().email('Email inválido'),
  phone: z.string().max(50).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  is_primary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

const updateContactSchema = createContactSchema.extend({
  id: z.string().uuid(),
});

// ============================================================
// HELPERS
// ============================================================

async function getAppUserOrSuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' as const };
  }

  // ¿Es super admin?
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superAdmin) {
    return { isSuperAdmin: true as const, supabase };
  }

  // Usuario regular
  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!appUser) {
    return { error: 'Usuario no encontrado' as const };
  }

  return {
    isSuperAdmin: false as const,
    supabase,
    userId: appUser.id,
    organizationId: appUser.organization_id,
  };
}

// Helper: parsea FormData a un objeto con los campos del cliente
function parseClientFormData(formData: FormData) {
  const addressStreet = formData.get('address_street') as string;
  const addressCity = formData.get('address_city') as string;
  const addressState = formData.get('address_state') as string;
  const addressCountry = formData.get('address_country') as string;
  const addressZip = formData.get('address_zip') as string;

  const hasAddress =
    addressStreet || addressCity || addressState || addressCountry || addressZip;

  return {
    name: (formData.get('name') as string)?.trim(),
    legal_name: ((formData.get('legal_name') as string) || '').trim() || null,
    tax_id: ((formData.get('tax_id') as string) || '').trim() || null,
    industry: ((formData.get('industry') as string) || '').trim() || null,
    website: ((formData.get('website') as string) || '').trim() || null,
    address: hasAddress
      ? {
          street: addressStreet?.trim() || undefined,
          city: addressCity?.trim() || undefined,
          state: addressState?.trim() || undefined,
          country: addressCountry?.trim() || undefined,
          zip: addressZip?.trim() || undefined,
        }
      : null,
    acquisition_source:
      ((formData.get('acquisition_source') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
    account_manager_id:
      (formData.get('account_manager_id') as string) || null,
  };
}

// ============================================================
// CREAR CLIENTE
// ============================================================

export async function createClientAction(formData: FormData) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const data = parseClientFormData(formData);

  const validation = createClientSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Si es super admin, debe venir organization_id explícito
  let organizationId: string;
  if (ctx.isSuperAdmin) {
    const orgFromForm = formData.get('organization_id') as string;
    if (!orgFromForm) {
      return { error: 'organization_id es requerido para super admin' };
    }
    organizationId = orgFromForm;
  } else {
    organizationId = ctx.organizationId;
  }

  const { data: newClient, error } = await ctx.supabase
    .from('clients')
    .insert({
      ...validation.data,
      organization_id: organizationId,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    return { error: `Error al crear cliente: ${error.message}` };
  }

  revalidatePath('/clients');
  return { success: true, clientId: newClient.id };
}

// ============================================================
// EDITAR CLIENTE
// ============================================================

export async function updateClientAction(formData: FormData) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const data = parseClientFormData(formData);
  const status = formData.get('status') as string;

  const validation = updateClientSchema.safeParse({
    ...data,
    id,
    status: status || undefined,
  });
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('clients')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { success: true };
}

// ============================================================
// ARCHIVAR CLIENTE (soft delete)
// ============================================================

export async function archiveClientAction(
  clientId: string,
  reason?: string
) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('clients')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: ctx.isSuperAdmin ? null : ctx.userId,
      archive_reason: reason || null,
      status: 'churned',
    })
    .eq('id', clientId);

  if (error) {
    return { error: `Error al archivar: ${error.message}` };
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ============================================================
// RESTAURAR CLIENTE ARCHIVADO
// ============================================================

export async function restoreClientAction(clientId: string) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('clients')
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      status: 'active',
    })
    .eq('id', clientId);

  if (error) {
    return { error: `Error al restaurar: ${error.message}` };
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ============================================================
// ELIMINAR CLIENTE (hard delete) — SOLO SUPER ADMIN
// ============================================================

export async function deleteClientAction(clientId: string) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return {
      error: 'Solo super admin puede eliminar clientes permanentemente',
    };
  }

  const { error } = await ctx.supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/clients');
  return { success: true };
}

// ============================================================
// CREAR CONTACTO
// ============================================================

export async function createContactAction(formData: FormData) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const rawData = {
    client_id: formData.get('client_id') as string,
    first_name: (formData.get('first_name') as string)?.trim(),
    last_name: (formData.get('last_name') as string)?.trim(),
    email: ((formData.get('email') as string) || '').toLowerCase().trim(),
    phone: ((formData.get('phone') as string) || '').trim() || null,
    position: ((formData.get('position') as string) || '').trim() || null,
    is_primary: formData.get('is_primary') === 'on',
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };

  const validation = createContactSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Obtener organization_id del cliente
  const { data: client } = await ctx.supabase
    .from('clients')
    .select('organization_id')
    .eq('id', validation.data.client_id)
    .maybeSingle();

  if (!client) {
    return { error: 'Cliente no encontrado' };
  }

  // Si is_primary=true, desmarcar otros primarios del mismo cliente
  if (validation.data.is_primary) {
    await ctx.supabase
      .from('contacts')
      .update({ is_primary: false })
      .eq('client_id', validation.data.client_id)
      .eq('is_primary', true);
  }

  const { error } = await ctx.supabase.from('contacts').insert({
    ...validation.data,
    organization_id: client.organization_id,
    created_by: ctx.isSuperAdmin ? null : ctx.userId,
  });

  if (error) {
    return { error: `Error al crear contacto: ${error.message}` };
  }

  revalidatePath(`/clients/${validation.data.client_id}`);
  return { success: true };
}

// ============================================================
// EDITAR CONTACTO
// ============================================================

export async function updateContactAction(formData: FormData) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const rawData = {
    id: formData.get('id') as string,
    client_id: formData.get('client_id') as string,
    first_name: (formData.get('first_name') as string)?.trim(),
    last_name: (formData.get('last_name') as string)?.trim(),
    email: ((formData.get('email') as string) || '').toLowerCase().trim(),
    phone: ((formData.get('phone') as string) || '').trim() || null,
    position: ((formData.get('position') as string) || '').trim() || null,
    is_primary: formData.get('is_primary') === 'on',
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };

  const validation = updateContactSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Si is_primary=true, desmarcar otros primarios del mismo cliente
  if (validation.data.is_primary) {
    await ctx.supabase
      .from('contacts')
      .update({ is_primary: false })
      .eq('client_id', validation.data.client_id)
      .eq('is_primary', true)
      .neq('id', validation.data.id);
  }

  const { id, client_id, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('contacts')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar contacto: ${error.message}` };
  }

  revalidatePath(`/clients/${client_id}`);
  return { success: true };
}

// ============================================================
// ELIMINAR CONTACTO
// ============================================================

export async function deleteContactAction(contactId: string, clientId: string) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ============================================================
// MARCAR CONTACTO COMO PRIMARIO
// ============================================================

export async function setPrimaryContactAction(
  contactId: string,
  clientId: string
) {
  const ctx = await getAppUserOrSuperAdmin();
  if ('error' in ctx) return { error: ctx.error };

  // Desmarcar todos los primarios del cliente
  await ctx.supabase
    .from('contacts')
    .update({ is_primary: false })
    .eq('client_id', clientId)
    .eq('is_primary', true);

  // Marcar el seleccionado
  const { error } = await ctx.supabase
    .from('contacts')
    .update({ is_primary: true })
    .eq('id', contactId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
