'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

const addItemSchema = z.object({
  quote_id: z.string().uuid(),
  service_id: z.string().uuid(),
  quantity: z.number().positive('La cantidad debe ser positiva').optional(),
});

const updateItemSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().positive().optional(),
  unit_price: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
});

const addAdjustmentSchema = z.object({
  quote_id: z.string().uuid(),
  adjustment_type: z.enum(['discount_percent', 'discount_amount', 'bonus']),
  label: z.string().min(1, 'Etiqueta requerida').max(200),
  amount: z.number().min(0, 'El monto no puede ser negativo'),
  description: z.string().optional().nullable(),
});

// ============================================================
// HELPER
// ============================================================

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' as const };

  return { supabase, userId: user.id };
}

async function recalculate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string
) {
  await supabase.rpc('recalculate_quote_totals', { p_quote_id: quoteId });
}

// ============================================================
// ITEMS — AGREGAR
// ============================================================

export async function addItemAction(payload: {
  quote_id: string;
  service_id: string;
  quantity?: number;
}) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const validation = addItemSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { quote_id, service_id, quantity = 1 } = validation.data;

  // 1. Cargar servicio del catálogo
  const { data: service } = await ctx.supabase
    .from('services')
    .select('*')
    .eq('id', service_id)
    .maybeSingle();

  if (!service) return { error: 'Servicio no encontrado' };

  // 2. Si es paquete, cargar su composición para snapshot
  let compositionSnapshot = null;
  if (service.service_type === 'package') {
    const { data: comp } = await ctx.supabase
      .from('package_composition')
      .select(
        '*, included_service:services!package_composition_included_service_id_fkey(name, unit)'
      )
      .eq('package_service_id', service_id)
      .order('position');

    if (comp && comp.length > 0) {
      compositionSnapshot = comp.map(
        (c: {
          included_service: { name: string; unit: string } | null;
          quantity: number;
          notes: string | null;
        }) => ({
          name: c.included_service?.name || 'Servicio',
          quantity: c.quantity,
          unit: c.included_service?.unit || 'pieza',
          notes: c.notes,
        })
      );
    }
  }

  // 3. Determinar position siguiente
  const { data: existingItems } = await ctx.supabase
    .from('quote_items')
    .select('position')
    .eq('quote_id', quote_id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition =
    existingItems && existingItems.length > 0
      ? existingItems[0].position + 1
      : 0;

  // 4. Insertar item con snapshot del servicio
  const { error: insertError } = await ctx.supabase.from('quote_items').insert({
    quote_id,
    service_id,
    service_type: service.service_type,
    name: service.name,
    description: service.description,
    unit: service.unit,
    quantity,
    unit_price: service.default_price,
    subtotal: quantity * Number(service.default_price),
    composition_snapshot: compositionSnapshot,
    position: nextPosition,
  });

  if (insertError) {
    return { error: `Error al agregar: ${insertError.message}` };
  }

  // 5. Recalcular totales
  await recalculate(ctx.supabase, quote_id);

  revalidatePath(`/quotes/${quote_id}`);
  return { success: true };
}

// ============================================================
// ITEMS — EDITAR (cantidad, precio, descripción)
// ============================================================

export async function updateItemAction(payload: {
  id: string;
  quantity?: number;
  unit_price?: number;
  description?: string | null;
}) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const validation = updateItemSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Cargar item actual para conocer quote_id y valores base
  const { data: current } = await ctx.supabase
    .from('quote_items')
    .select('quote_id, quantity, unit_price')
    .eq('id', payload.id)
    .maybeSingle();

  if (!current) return { error: 'Item no encontrado' };

  const newQuantity = validation.data.quantity ?? Number(current.quantity);
  const newUnitPrice =
    validation.data.unit_price ?? Number(current.unit_price);

  const updateData: {
    quantity: number;
    unit_price: number;
    subtotal: number;
    description?: string | null;
  } = {
    quantity: newQuantity,
    unit_price: newUnitPrice,
    subtotal: newQuantity * newUnitPrice,
  };

  if (validation.data.description !== undefined) {
    updateData.description = validation.data.description;
  }

  const { error } = await ctx.supabase
    .from('quote_items')
    .update(updateData)
    .eq('id', payload.id);

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, current.quote_id);

  revalidatePath(`/quotes/${current.quote_id}`);
  return { success: true };
}

// ============================================================
// ITEMS — ELIMINAR
// ============================================================

export async function removeItemAction(itemId: string) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const { data: item } = await ctx.supabase
    .from('quote_items')
    .select('quote_id')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: 'Item no encontrado' };

  const { error } = await ctx.supabase
    .from('quote_items')
    .delete()
    .eq('id', itemId);

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, item.quote_id);

  revalidatePath(`/quotes/${item.quote_id}`);
  return { success: true };
}

// ============================================================
// ITEMS — REORDENAR
// ============================================================

export async function reorderItemsAction(
  quoteId: string,
  itemIds: string[]
) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  for (let i = 0; i < itemIds.length; i++) {
    await ctx.supabase
      .from('quote_items')
      .update({ position: i })
      .eq('id', itemIds[i])
      .eq('quote_id', quoteId);
  }

  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

// ============================================================
// AJUSTES — AGREGAR
// ============================================================

export async function addAdjustmentAction(payload: {
  quote_id: string;
  adjustment_type: 'discount_percent' | 'discount_amount' | 'bonus';
  label: string;
  amount: number;
  description?: string | null;
}) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const validation = addAdjustmentSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // Validar % no mayor a 100
  if (
    validation.data.adjustment_type === 'discount_percent' &&
    validation.data.amount > 100
  ) {
    return { error: 'El descuento porcentual no puede ser mayor a 100%' };
  }

  // Determinar posición
  const { data: existing } = await ctx.supabase
    .from('quote_adjustments')
    .select('position')
    .eq('quote_id', validation.data.quote_id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition =
    existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { error } = await ctx.supabase.from('quote_adjustments').insert({
    quote_id: validation.data.quote_id,
    adjustment_type: validation.data.adjustment_type,
    label: validation.data.label,
    description: validation.data.description,
    amount: validation.data.amount,
    calculated_amount: 0, // se recalcula
    position: nextPosition,
  });

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, validation.data.quote_id);

  revalidatePath(`/quotes/${validation.data.quote_id}`);
  return { success: true };
}

// ============================================================
// AJUSTES — EDITAR
// ============================================================

export async function updateAdjustmentAction(payload: {
  id: string;
  label?: string;
  amount?: number;
  description?: string | null;
}) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const { data: current } = await ctx.supabase
    .from('quote_adjustments')
    .select('quote_id, adjustment_type')
    .eq('id', payload.id)
    .maybeSingle();

  if (!current) return { error: 'Ajuste no encontrado' };

  // Validar % no mayor a 100 si aplica
  if (
    payload.amount !== undefined &&
    current.adjustment_type === 'discount_percent' &&
    payload.amount > 100
  ) {
    return { error: 'El descuento porcentual no puede ser mayor a 100%' };
  }

  const updateData: {
    label?: string;
    amount?: number;
    description?: string | null;
  } = {};
  if (payload.label !== undefined) updateData.label = payload.label;
  if (payload.amount !== undefined) updateData.amount = payload.amount;
  if (payload.description !== undefined)
    updateData.description = payload.description;

  const { error } = await ctx.supabase
    .from('quote_adjustments')
    .update(updateData)
    .eq('id', payload.id);

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, current.quote_id);

  revalidatePath(`/quotes/${current.quote_id}`);
  return { success: true };
}

// ============================================================
// AJUSTES — ELIMINAR
// ============================================================

export async function removeAdjustmentAction(adjustmentId: string) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const { data: current } = await ctx.supabase
    .from('quote_adjustments')
    .select('quote_id')
    .eq('id', adjustmentId)
    .maybeSingle();

  if (!current) return { error: 'Ajuste no encontrado' };

  const { error } = await ctx.supabase
    .from('quote_adjustments')
    .delete()
    .eq('id', adjustmentId);

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, current.quote_id);

  revalidatePath(`/quotes/${current.quote_id}`);
  return { success: true };
}

// ============================================================
// IMPUESTOS — AGREGAR (snapshot del catálogo)
// ============================================================

export async function addTaxToQuoteAction(payload: {
  quote_id: string;
  tax_id: string;
}) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  // Verificar no duplicado
  const { data: existing } = await ctx.supabase
    .from('quote_taxes')
    .select('id')
    .eq('quote_id', payload.quote_id)
    .eq('tax_id', payload.tax_id)
    .maybeSingle();

  if (existing) {
    return { error: 'Este impuesto ya está aplicado a la cotización' };
  }

  // Cargar impuesto del catálogo
  const { data: tax } = await ctx.supabase
    .from('taxes')
    .select('*')
    .eq('id', payload.tax_id)
    .maybeSingle();

  if (!tax) return { error: 'Impuesto no encontrado' };

  // Determinar position
  const { data: existingTaxes } = await ctx.supabase
    .from('quote_taxes')
    .select('position')
    .eq('quote_id', payload.quote_id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition =
    existingTaxes && existingTaxes.length > 0
      ? existingTaxes[0].position + 1
      : 0;

  const { error } = await ctx.supabase.from('quote_taxes').insert({
    quote_id: payload.quote_id,
    tax_id: tax.id,
    name: tax.name,
    code: tax.code,
    percentage: tax.percentage,
    tax_amount: 0, // se recalcula
    position: nextPosition,
  });

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, payload.quote_id);

  revalidatePath(`/quotes/${payload.quote_id}`);
  return { success: true };
}

// ============================================================
// IMPUESTOS — ELIMINAR
// ============================================================

export async function removeTaxFromQuoteAction(quoteTaxId: string) {
  const ctx = await getCtx();
  if ('error' in ctx) return { error: ctx.error };

  const { data: current } = await ctx.supabase
    .from('quote_taxes')
    .select('quote_id')
    .eq('id', quoteTaxId)
    .maybeSingle();

  if (!current) return { error: 'Impuesto no encontrado' };

  const { error } = await ctx.supabase
    .from('quote_taxes')
    .delete()
    .eq('id', quoteTaxId);

  if (error) return { error: `Error: ${error.message}` };

  await recalculate(ctx.supabase, current.quote_id);

  revalidatePath(`/quotes/${current.quote_id}`);
  return { success: true };
}
