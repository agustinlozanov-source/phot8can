'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { QuoteLayer } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const createQuoteSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  contact_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  valid_until: z.string().optional(), // ISO date
});

const updateQuoteMetaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  valid_until: z.string().optional(),
  message_to_client: z.string().optional().nullable(),
  notes_internal: z.string().optional().nullable(),
  layers: z.array(z.any()).optional(), // capas modificadas por la cotización
});

// ============================================================
// HELPER DE CONTEXTO
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
  };
}

function resolveOrgId(
  ctx: Exclude<Awaited<ReturnType<typeof getContext>>, { error: string }>
): string | null {
  if (!ctx.isSuperAdmin) return ctx.organizationId;
  if (ctx.impersonatingOrgId) return ctx.impersonatingOrgId;
  return null;
}

// ============================================================
// CREAR COTIZACIÓN
// ============================================================

export async function createQuoteAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) {
    return { error: 'No se pudo determinar la organización' };
  }

  const rawData = {
    client_id: formData.get('client_id') as string,
    contact_id: (formData.get('contact_id') as string) || null,
    template_id: (formData.get('template_id') as string) || null,
    title: (formData.get('title') as string)?.trim() || null,
    valid_until: (formData.get('valid_until') as string) || undefined,
  };

  const validation = createQuoteSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // 1. Cargar plantilla (la elegida, o la default de la org)
  let templateData = null;
  if (validation.data.template_id) {
    const { data } = await ctx.supabase
      .from('quote_templates')
      .select('*')
      .eq('id', validation.data.template_id)
      .maybeSingle();
    templateData = data;
  } else {
    const { data } = await ctx.supabase
      .from('quote_templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    templateData = data;
  }

  if (!templateData) {
    return {
      error:
        'No hay plantilla disponible. Crea una plantilla en /catalog/templates primero.',
    };
  }

  // 2. Generar folio único
  const { data: folioResult, error: folioError } = await ctx.supabase.rpc(
    'generate_quote_folio',
    {
      p_organization_id: orgId,
      p_prefix: templateData.folio_prefix,
    }
  );

  if (folioError || !folioResult) {
    return { error: `Error al generar folio: ${folioError?.message}` };
  }

  // 3. Calcular fecha de vigencia (si no vino del form, usar default de plantilla)
  const validUntil =
    validation.data.valid_until ||
    new Date(
      Date.now() + templateData.valid_days_default * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0];

  // 4. Insertar cotización con snapshot de las capas
  const { data: newQuote, error: insertError } = await ctx.supabase
    .from('quotes')
    .insert({
      organization_id: orgId,
      folio: folioResult,
      title: validation.data.title,
      client_id: validation.data.client_id,
      contact_id: validation.data.contact_id,
      template_id: templateData.id,
      status: 'draft',
      valid_until: validUntil,
      currency: templateData.currency_default,
      layers: templateData.layers, // snapshot
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, folio')
    .single();

  if (insertError) {
    return { error: `Error al crear cotización: ${insertError.message}` };
  }

  // 5. Aplicar impuestos default de la organización
  const { data: defaultTaxes } = await ctx.supabase
    .from('taxes')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_enabled', true)
    .eq('apply_by_default', true)
    .order('position');

  if (defaultTaxes && defaultTaxes.length > 0) {
    const taxesToInsert = defaultTaxes.map((tax, idx) => ({
      quote_id: newQuote.id,
      tax_id: tax.id,
      name: tax.name,
      code: tax.code,
      percentage: tax.percentage,
      tax_amount: 0, // se recalcula con la función
      position: idx,
    }));

    await ctx.supabase.from('quote_taxes').insert(taxesToInsert);
  }

  // 6. Recalcular totales (aún en cero porque no hay items, pero deja todo consistente)
  await ctx.supabase.rpc('recalculate_quote_totals', {
    p_quote_id: newQuote.id,
  });

  revalidatePath('/quotes');
  return {
    success: true,
    quoteId: newQuote.id,
    folio: newQuote.folio,
  };
}

// ============================================================
// EDITAR METADATA DE COTIZACIÓN
// ============================================================

export async function updateQuoteMetaAction(formData: FormData) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID requerido' };

  const layersRaw = formData.get('layers') as string;
  let layers: QuoteLayer[] | undefined;
  if (layersRaw) {
    try {
      layers = JSON.parse(layersRaw);
    } catch {
      // ignorar
    }
  }

  const rawData = {
    id,
    title: ((formData.get('title') as string) || '').trim() || null,
    contact_id: (formData.get('contact_id') as string) || null,
    valid_until: (formData.get('valid_until') as string) || undefined,
    message_to_client:
      ((formData.get('message_to_client') as string) || '').trim() || null,
    notes_internal:
      ((formData.get('notes_internal') as string) || '').trim() || null,
    layers,
  };

  const validation = updateQuoteMetaSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { id: _, ...updateData } = validation.data;

  const { error } = await ctx.supabase
    .from('quotes')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

// ============================================================
// DUPLICAR COTIZACIÓN
// ============================================================

export async function duplicateQuoteAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // 1. Cargar cotización original con todo
  const { data: original } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (!original) return { error: 'Cotización no encontrada' };

  // 2. Generar nuevo folio
  const prefix = original.folio.split('-')[0];
  const { data: newFolio } = await ctx.supabase.rpc('generate_quote_folio', {
    p_organization_id: original.organization_id,
    p_prefix: prefix,
  });

  if (!newFolio) {
    return { error: 'Error al generar folio' };
  }

  // 3. Crear nueva cotización
  const { data: newQuote, error: insertError } = await ctx.supabase
    .from('quotes')
    .insert({
      organization_id: original.organization_id,
      folio: newFolio,
      title: original.title ? `${original.title} (copia)` : null,
      client_id: original.client_id,
      contact_id: original.contact_id,
      template_id: original.template_id,
      status: 'draft', // nueva siempre es borrador
      valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      currency: original.currency,
      layers: original.layers,
      message_to_client: original.message_to_client,
      notes_internal: original.notes_internal,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (insertError || !newQuote) {
    return { error: `Error al duplicar: ${insertError?.message}` };
  }

  // 4. Copiar items
  const { data: items } = await ctx.supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId);

  if (items && items.length > 0) {
    const itemsToInsert = items.map((item) => ({
      quote_id: newQuote.id,
      service_id: item.service_id,
      service_type: item.service_type,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      composition_snapshot: item.composition_snapshot,
      position: item.position,
    }));
    await ctx.supabase.from('quote_items').insert(itemsToInsert);
  }

  // 5. Copiar ajustes
  const { data: adjustments } = await ctx.supabase
    .from('quote_adjustments')
    .select('*')
    .eq('quote_id', quoteId);

  if (adjustments && adjustments.length > 0) {
    const adjsToInsert = adjustments.map((adj) => ({
      quote_id: newQuote.id,
      adjustment_type: adj.adjustment_type,
      label: adj.label,
      description: adj.description,
      amount: adj.amount,
      calculated_amount: adj.calculated_amount,
      position: adj.position,
    }));
    await ctx.supabase.from('quote_adjustments').insert(adjsToInsert);
  }

  // 6. Copiar impuestos
  const { data: taxes } = await ctx.supabase
    .from('quote_taxes')
    .select('*')
    .eq('quote_id', quoteId);

  if (taxes && taxes.length > 0) {
    const taxesToInsert = taxes.map((tax) => ({
      quote_id: newQuote.id,
      tax_id: tax.tax_id,
      name: tax.name,
      code: tax.code,
      percentage: tax.percentage,
      tax_amount: 0,
      position: tax.position,
    }));
    await ctx.supabase.from('quote_taxes').insert(taxesToInsert);
  }

  // 7. Recalcular totales
  await ctx.supabase.rpc('recalculate_quote_totals', {
    p_quote_id: newQuote.id,
  });

  revalidatePath('/quotes');
  return { success: true, quoteId: newQuote.id };
}

// ============================================================
// ELIMINAR COTIZACIÓN (solo borradores)
// ============================================================

export async function deleteQuoteAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Verificar que sea borrador
  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('status')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  if (quote.status !== 'draft' && !ctx.isSuperAdmin) {
    return {
      error:
        'Solo se pueden eliminar cotizaciones en borrador. Las enviadas se archivan.',
    };
  }

  const { error } = await ctx.supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath('/quotes');
  return { success: true };
}

// ============================================================
// ENVIAR COTIZACIÓN (draft → sent)
// ============================================================

export async function sendQuoteAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  // Verificar estado y datos mínimos
  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('id, status, public_share_token, subtotal')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  if (quote.status !== 'draft') {
    return { error: 'Solo cotizaciones en borrador pueden enviarse' };
  }

  if (Number(quote.subtotal) <= 0) {
    return {
      error:
        'La cotización no tiene servicios. Agrega al menos uno antes de enviar.',
    };
  }

  // Generar token de compartir si no existe
  let token = quote.public_share_token;
  if (!token) {
    const { data: tokenResult } = await ctx.supabase.rpc(
      'generate_share_token'
    );
    token = tokenResult;
  }

  const { error } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      public_share_token: token,
    })
    .eq('id', quoteId);

  if (error) {
    return { error: `Error al enviar: ${error.message}` };
  }

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true, shareToken: token };
}

// ============================================================
// MARCAR COMO VISTA (público, sin auth)
// ============================================================

export async function markAsViewedAction(shareToken: string) {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = await createServiceClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, status, viewed_at')
    .eq('public_share_token', shareToken)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  // Solo cambiar a 'viewed' si está en 'sent' y no se ha visto
  if (quote.status === 'sent' && !quote.viewed_at) {
    await supabase
      .from('quotes')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', quote.id);
  }

  return { success: true };
}

// ============================================================
// APROBAR / RECHAZAR
// ============================================================

export async function approveQuoteAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('status')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  if (!['sent', 'viewed'].includes(quote.status)) {
    return { error: 'Solo cotizaciones enviadas o vistas pueden aprobarse' };
  }

  const { error } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

export async function rejectQuoteAction(quoteId: string, reason?: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('status')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  if (!['sent', 'viewed'].includes(quote.status)) {
    return { error: 'Solo cotizaciones enviadas o vistas pueden rechazarse' };
  }

  const { error } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', quoteId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

// ============================================================
// REVERTIR A BORRADOR (sent → draft)
// ============================================================

export async function revertToDraftAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('status')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { error: 'Cotización no encontrada' };

  if (quote.status !== 'sent') {
    return {
      error: 'Solo cotizaciones enviadas (no vistas) pueden volver a borrador',
    };
  }

  const { error } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'draft',
      sent_at: null,
    })
    .eq('id', quoteId);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

// ============================================================
// RECALCULAR TOTALES (utilidad expuesta)
// ============================================================

export async function recalculateQuoteTotalsAction(quoteId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase.rpc('recalculate_quote_totals', {
    p_quote_id: quoteId,
  });

  if (error) return { error: `Error al recalcular: ${error.message}` };

  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}
