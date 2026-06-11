'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const layerSchema = z.object({
  kind: z.enum([
    'cover',
    'introduction',
    'scope',
    'deliverables',
    'investment',
    'terms',
    'closing',
  ]),
  order: z.number().int().min(0),
  enabled: z.boolean(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content_html: z.string().optional(),
  auto_generated: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  description: z.string().max(1000).optional().nullable(),
  folio_prefix: z
    .string()
    .min(1, 'Prefijo requerido')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones'),
  valid_days_default: z
    .number()
    .int()
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días'),
  currency_default: z.string().length(3),
  layers: z.array(layerSchema).min(1, 'Al menos una capa requerida'),
  primary_color: z.string().max(20).optional().nullable(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().uuid(),
});

// ============================================================
// HELPER DE CONTEXTO
// ============================================================

async function getContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' as const };
  }

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
    };
  }

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

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>,
  formOrgId?: string | null
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  if (formOrgId) return formOrgId;
  return null;
}

// ============================================================
// PARSEAR DATOS DE FORMULARIO
// ============================================================

function parseTemplateFormData(formData: FormData) {
  // Las capas vienen como JSON serializado en un campo hidden
  let layers: unknown[] = [];
  const layersRaw = formData.get('layers') as string;
  if (layersRaw) {
    try {
      layers = JSON.parse(layersRaw);
    } catch {
      layers = [];
    }
  }

  return {
    name: ((formData.get('name') as string) || '').trim(),
    description: ((formData.get('description') as string) || '').trim() || null,
    folio_prefix: ((formData.get('folio_prefix') as string) || 'COT')
      .trim()
      .toUpperCase(),
    valid_days_default: parseInt(
      (formData.get('valid_days_default') as string) || '15',
      10
    ),
    currency_default: ((formData.get('currency_default') as string) || 'MXN')
      .trim()
      .toUpperCase(),
    layers,
    primary_color:
      ((formData.get('primary_color') as string) || '').trim() || null,
    is_default: formData.get('is_default') === 'on',
    is_active: formData.get('is_active') !== 'off', // default true
  };
}

// ============================================================
// CREAR PLANTILLA
// ============================================================

export async function createQuoteTemplateAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const data = parseTemplateFormData(formData);

  const validation = createTemplateSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx, formData.get('organization_id') as string);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  // Si esta plantilla se marca como default, desmarcar la actual default
  if (validation.data.is_default) {
    await ctx.supabase
      .from('quote_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('is_default', true);
  }

  const { data: newTemplate, error } = await ctx.supabase
    .from('quote_templates')
    .insert({
      ...validation.data,
      organization_id: orgId,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error) {
    return { error: `Error al crear plantilla: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true, templateId: newTemplate.id };
}

// ============================================================
// EDITAR PLANTILLA
// ============================================================

export async function updateQuoteTemplateAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const data = { ...parseTemplateFormData(formData), id };

  const validation = updateTemplateSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Obtener organization_id de la plantilla
  const { data: template } = await ctx.supabase
    .from('quote_templates')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();

  if (!template) {
    return { error: 'Plantilla no encontrada' };
  }

  // Si se marca como default, desmarcar las demás
  if (validation.data.is_default) {
    await ctx.supabase
      .from('quote_templates')
      .update({ is_default: false })
      .eq('organization_id', template.organization_id)
      .eq('is_default', true)
      .neq('id', id);
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('quote_templates')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  revalidatePath(`/catalog/templates/${id}`);
  return { success: true };
}

// ============================================================
// MARCAR COMO DEFAULT
// ============================================================

export async function setDefaultTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: template } = await ctx.supabase
    .from('quote_templates')
    .select('organization_id')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    return { error: 'Plantilla no encontrada' };
  }

  // Desmarcar todas
  await ctx.supabase
    .from('quote_templates')
    .update({ is_default: false })
    .eq('organization_id', template.organization_id)
    .eq('is_default', true);

  // Marcar la seleccionada
  const { error } = await ctx.supabase
    .from('quote_templates')
    .update({ is_default: true })
    .eq('id', templateId);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true };
}

// ============================================================
// ARCHIVAR / RESTAURAR
// ============================================================

export async function archiveQuoteTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('quote_templates')
    .update({
      archived_at: new Date().toISOString(),
      is_active: false,
      is_default: false, // si era default, dejar de serlo
    })
    .eq('id', templateId);

  if (error) {
    return { error: `Error al archivar: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true };
}

export async function restoreQuoteTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from('quote_templates')
    .update({
      archived_at: null,
      is_active: true,
    })
    .eq('id', templateId);

  if (error) {
    return { error: `Error al restaurar: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true };
}

// ============================================================
// ELIMINAR (solo super admin)
// ============================================================

export async function deleteQuoteTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin) {
    return {
      error: 'Solo super admin puede eliminar plantillas permanentemente',
    };
  }

  // Verificar que no haya cotizaciones usando esta plantilla
  const { count } = await ctx.supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', templateId);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: hay ${count} cotizaciones usando esta plantilla. Archívala en su lugar.`,
    };
  }

  const { error } = await ctx.supabase
    .from('quote_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true };
}

// ============================================================
// DUPLICAR PLANTILLA
// ============================================================

export async function duplicateQuoteTemplateAction(templateId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Cargar la plantilla original
  const { data: original } = await ctx.supabase
    .from('quote_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (!original) {
    return { error: 'Plantilla no encontrada' };
  }

  // Crear copia
  const { data: newTemplate, error } = await ctx.supabase
    .from('quote_templates')
    .insert({
      organization_id: original.organization_id,
      name: `${original.name} (copia)`,
      description: original.description,
      folio_prefix: original.folio_prefix,
      valid_days_default: original.valid_days_default,
      currency_default: original.currency_default,
      layers: original.layers,
      primary_color: original.primary_color,
      is_default: false, // la copia nunca es default
      is_active: true,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (error) {
    return { error: `Error al duplicar: ${error.message}` };
  }

  revalidatePath('/catalog/templates');
  return { success: true, templateId: newTemplate.id };
}
