'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ContractBody } from '@/lib/types/database';

// ============================================================
// SCHEMAS
// ============================================================

const createFromContractSchema = z.object({
  contract_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
});

const startPeriodSchema = z.object({
  subscription_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const adjustDeliverableSchema = z.object({
  period_deliverable_id: z.string().uuid(),
  new_quantity: z.number().int().min(0).max(10000),
  reason: z.string().min(5).max(500),
});

const cancelSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const pauseSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
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
// 🌟 CREAR SUSCRIPCIÓN DESDE CONTRATO FIRMADO
// ============================================================

export async function createSubscriptionFromContractAction(payload: {
  contract_id: string;
  name?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = createFromContractSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // 1. Cargar contrato
  const { data: contract } = await ctx.supabase
    .from('contracts')
    .select(
      `
      id, organization_id, client_id, status,
      contract_body, billing_cycle, total_amount, currency,
      start_date,
      client:clients(id, name)
    `
    )
    .eq('id', validation.data.contract_id)
    .maybeSingle();

  if (!contract) return { error: 'Contrato no encontrado' };
  if (contract.organization_id !== orgId) {
    return { error: 'Contrato no pertenece a tu organización' };
  }
  if (contract.status !== 'signed') {
    return {
      error: `El contrato debe estar firmado (actual: ${contract.status})`,
    };
  }

  // 2. Verificar que no exista suscripción activa para este contrato
  const { data: existingSub } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('source_contract_id', contract.id)
    .neq('status', 'cancelled')
    .maybeSingle();

  if (existingSub) {
    return {
      error: `Ya existe una suscripción para este contrato (estado: ${existingSub.status})`,
    };
  }

  // 3. Construir el nombre de la suscripción
  const client = contract.client as unknown as { id: string; name: string };
  const cycleLabels: Record<string, string> = {
    monthly: 'mensual',
    quarterly: 'trimestral',
    annual: 'anual',
    one_time: 'único',
  };
  const subscriptionName =
    validation.data.name ||
    `Plan ${cycleLabels[contract.billing_cycle] || ''} — ${client.name}`;

  // 4. Crear la suscripción
  const { data: newSub, error: subError } = await ctx.supabase
    .from('client_subscriptions')
    .insert({
      organization_id: orgId,
      client_id: contract.client_id,
      source_contract_id: contract.id,
      name: subscriptionName.trim(),
      status: 'pending_start',
      billing_cycle: contract.billing_cycle,
      price_per_period: contract.total_amount,
      currency: contract.currency,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (subError || !newSub) {
    return { error: `Error al crear suscripción: ${subError?.message}` };
  }

  // 5. Crear los deliverables base del contrato.
  //    Si un servicio es un paquete, lo expandimos en sus componentes.
  const body = contract.contract_body as unknown as ContractBody;

  const deliverables: Array<{
    subscription_id: string;
    service_id: string | null;
    service_name: string;
    service_type: string | null;
    unit: string | null;
    quantity_per_period: number;
    notes: string | null;
    position: number;
  }> = [];

  let position = 0;

  for (const service of body.services) {
    // Si NO es paquete o no tiene service_id, agregar tal cual
    if (service.service_type !== 'package' || !service.service_id) {
      deliverables.push({
        subscription_id: newSub.id,
        service_id: service.service_id || null,
        service_name: service.name,
        service_type: service.service_type || null,
        unit: service.unit || null,
        quantity_per_period: service.quantity,
        notes: service.description || null,
        position: position++,
      });
      continue;
    }

    // ES UN PAQUETE: cargar sus componentes
    const { data: components } = await ctx.supabase
      .from('package_composition')
      .select(
        `
        quantity,
        position,
        notes,
        included_service:services!package_composition_included_service_id_fkey(
          id, name, service_type, unit
        )
      `
      )
      .eq('package_service_id', service.service_id)
      .order('position');

    if (!components || components.length === 0) {
      // Paquete vacío o sin componentes — agregar el paquete como fallback
      deliverables.push({
        subscription_id: newSub.id,
        service_id: service.service_id,
        service_name: service.name,
        service_type: 'package',
        unit: service.unit || null,
        quantity_per_period: service.quantity,
        notes: service.description || null,
        position: position++,
      });
      continue;
    }

    // Expandir cada componente
    for (const comp of components) {
      const child = comp.included_service as unknown as {
        id: string;
        name: string;
        service_type: string | null;
        unit: string | null;
      } | null;

      if (!child) continue;

      deliverables.push({
        subscription_id: newSub.id,
        service_id: child.id,
        service_name: child.name,
        service_type: child.service_type,
        unit: child.unit,
        // Multiplicar componente_qty × paquete_qty
        // (si el cliente compró 2 Paquetes Silver, son 24 posts + 32 reels)
        quantity_per_period: comp.quantity * service.quantity,
        notes: comp.notes || null,
        position: position++,
      });
    }
  }

  if (deliverables.length > 0) {
    const { error: delError } = await ctx.supabase
      .from('subscription_deliverables')
      .insert(deliverables);

    if (delError) {
      // Rollback: borrar la suscripción si falló al crear deliverables
      await ctx.supabase
        .from('client_subscriptions')
        .delete()
        .eq('id', newSub.id);
      return {
        error: `Error al crear entregables: ${delError.message}. Suscripción revertida.`,
      };
    }
  }

  revalidatePath('/subscriptions');
  revalidatePath(`/contracts/${contract.id}`);

  return { success: true, subscriptionId: newSub.id };
}

// ============================================================
// 🌟 INICIAR PRIMER PERÍODO
// ============================================================

export async function startFirstPeriodAction(payload: {
  subscription_id: string;
  start_date: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = startPeriodSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // 1. Cargar suscripción
  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status, billing_cycle, organization_id')
    .eq('id', validation.data.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };
  if (subscription.status !== 'pending_start') {
    return {
      error: `Solo se puede iniciar una suscripción pendiente (actual: ${subscription.status})`,
    };
  }

  // 2. Calcular end_date usando función SQL
  const { data: endDate } = await ctx.supabase.rpc('calculate_period_end_date', {
    p_start_date: validation.data.start_date,
    p_billing_cycle: subscription.billing_cycle,
  });

  if (!endDate) {
    return { error: 'Error al calcular fecha de fin del período' };
  }

  // 3. Cargar los deliverables base
  const { data: templateDeliverables } = await ctx.supabase
    .from('subscription_deliverables')
    .select('id, service_id, service_name, service_type, unit, quantity_per_period, notes, position')
    .eq('subscription_id', subscription.id)
    .order('position');

  if (!templateDeliverables || templateDeliverables.length === 0) {
    return { error: 'La suscripción no tiene entregables base' };
  }

  // 4. Crear el primer período
  const { data: newPeriod, error: periodError } = await ctx.supabase
    .from('subscription_periods')
    .insert({
      subscription_id: subscription.id,
      period_number: 1,
      start_date: validation.data.start_date,
      end_date: endDate as string,
      status: 'active',
      started_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (periodError || !newPeriod) {
    return { error: `Error al crear período: ${periodError?.message}` };
  }

  // 5. Crear period_deliverables (copia de los templates)
  const periodDeliverables = templateDeliverables.map((td) => ({
    period_id: newPeriod.id,
    template_deliverable_id: td.id,
    service_id: td.service_id,
    service_name: td.service_name,
    service_type: td.service_type,
    unit: td.unit,
    quantity_planned: td.quantity_per_period,
    notes: td.notes,
    position: td.position,
  }));

  const { error: pdError } = await ctx.supabase
    .from('period_deliverables')
    .insert(periodDeliverables);

  if (pdError) {
    // Rollback el período
    await ctx.supabase
      .from('subscription_periods')
      .delete()
      .eq('id', newPeriod.id);
    return {
      error: `Error al crear entregables del período: ${pdError.message}`,
    };
  }

  // 6. Actualizar la suscripción a 'active'
  const { error: updateError } = await ctx.supabase
    .from('client_subscriptions')
    .update({
      status: 'active',
      start_date: validation.data.start_date,
      current_period_start: validation.data.start_date,
      current_period_end: endDate as string,
      next_renewal_date: endDate as string,
      total_periods_billed: 1,
    })
    .eq('id', subscription.id);

  if (updateError) {
    return { error: `Error al activar suscripción: ${updateError.message}` };
  }

  revalidatePath('/subscriptions');
  revalidatePath(`/subscriptions/${subscription.id}`);

  return { success: true, periodId: newPeriod.id };
}

// ============================================================
// AJUSTAR CANTIDAD DE UN ENTREGABLE DEL PERÍODO
// ============================================================

export async function adjustPeriodDeliverableAction(payload: {
  period_deliverable_id: string;
  new_quantity: number;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = adjustDeliverableSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // 1. Cargar el deliverable actual
  const { data: deliverable } = await ctx.supabase
    .from('period_deliverables')
    .select(
      `
      id, quantity_planned,
      period:subscription_periods!period_deliverables_period_id_fkey(
        id, status,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(
          id, organization_id
        )
      )
    `
    )
    .eq('id', validation.data.period_deliverable_id)
    .maybeSingle();

  if (!deliverable) return { error: 'Entregable no encontrado' };

  const period = deliverable.period as unknown as {
    id: string;
    status: string;
    subscription: { id: string; organization_id: string };
  };

  if (period.status !== 'active') {
    return {
      error: 'Solo se pueden ajustar entregables de períodos activos',
    };
  }

  // 2. Si la cantidad no cambió, no hacer nada
  if (deliverable.quantity_planned === validation.data.new_quantity) {
    return { success: true, unchanged: true };
  }

  const previousQuantity = deliverable.quantity_planned;

  // 3. Actualizar el deliverable
  const { error: updateError } = await ctx.supabase
    .from('period_deliverables')
    .update({
      quantity_planned: validation.data.new_quantity,
      adjustment_reason: validation.data.reason.trim(),
    })
    .eq('id', validation.data.period_deliverable_id);

  if (updateError) {
    return { error: `Error al ajustar: ${updateError.message}` };
  }

  // 4. Registrar en el audit log
  const { error: logError } = await ctx.supabase
    .from('period_deliverable_adjustments')
    .insert({
      period_deliverable_id: validation.data.period_deliverable_id,
      previous_quantity: previousQuantity,
      new_quantity: validation.data.new_quantity,
      reason: validation.data.reason.trim(),
      adjusted_by: ctx.isSuperAdmin ? null : ctx.userId,
    });

  if (logError) {
    console.error('Error en audit log de ajuste:', logError);
    // No revertimos: el ajuste ya está hecho, solo loggeamos el fail del log
  }

  revalidatePath(`/subscriptions/${period.subscription.id}`);
  return { success: true };
}

// ============================================================
// MARCAR ENTREGABLE COMO COMPLETADO (incrementar quantity_delivered)
// ============================================================

export async function updateDeliveredQuantityAction(payload: {
  period_deliverable_id: string;
  new_delivered: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (payload.new_delivered < 0 || payload.new_delivered > 10000) {
    return { error: 'Cantidad inválida' };
  }

  const { data: deliverable } = await ctx.supabase
    .from('period_deliverables')
    .select(
      `
      id, quantity_planned,
      period:subscription_periods!period_deliverables_period_id_fkey(
        id, status,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(id)
      )
    `
    )
    .eq('id', payload.period_deliverable_id)
    .maybeSingle();

  if (!deliverable) return { error: 'Entregable no encontrado' };

  const period = deliverable.period as unknown as {
    id: string;
    status: string;
    subscription: { id: string };
  };

  if (period.status !== 'active') {
    return { error: 'Solo se pueden actualizar entregables de períodos activos' };
  }

  const { error } = await ctx.supabase
    .from('period_deliverables')
    .update({ quantity_delivered: payload.new_delivered })
    .eq('id', payload.period_deliverable_id);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath(`/subscriptions/${period.subscription.id}`);
  return { success: true };
}

// ============================================================
// COMPLETAR PERÍODO ACTUAL
// ============================================================

export async function completePeriodAction(periodId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: period } = await ctx.supabase
    .from('subscription_periods')
    .select('id, status, subscription_id, period_number')
    .eq('id', periodId)
    .maybeSingle();

  if (!period) return { error: 'Período no encontrado' };

  if (period.status !== 'active') {
    return {
      error: `Solo se puede completar un período activo (actual: ${period.status})`,
    };
  }

  const { error } = await ctx.supabase
    .from('subscription_periods')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', periodId);

  if (error) {
    return { error: `Error al completar período: ${error.message}` };
  }

  revalidatePath(`/subscriptions/${period.subscription_id}`);
  return { success: true };
}

// ============================================================
// INICIAR NUEVO PERÍODO (RENOVACIÓN)
// ============================================================

export async function renewPeriodAction(payload: {
  subscription_id: string;
  start_date: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = startPeriodSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  // 1. Cargar suscripción
  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status, billing_cycle, total_periods_billed')
    .eq('id', validation.data.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };
  if (subscription.status !== 'active') {
    return {
      error: `Solo se pueden renovar suscripciones activas (actual: ${subscription.status})`,
    };
  }

  // 2. Verificar que el período anterior esté completado
  const { data: lastPeriod } = await ctx.supabase
    .from('subscription_periods')
    .select('id, status, period_number')
    .eq('subscription_id', subscription.id)
    .order('period_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastPeriod) {
    return { error: 'No hay períodos previos. Usa "Iniciar primer período".' };
  }

  if (lastPeriod.status === 'active') {
    return {
      error: 'Completa el período actual antes de iniciar uno nuevo',
    };
  }

  // 3. Calcular end_date del nuevo período
  const { data: endDate } = await ctx.supabase.rpc('calculate_period_end_date', {
    p_start_date: validation.data.start_date,
    p_billing_cycle: subscription.billing_cycle,
  });

  if (!endDate) {
    return { error: 'Error al calcular fecha de fin del período' };
  }

  // 4. Cargar los deliverables base
  const { data: templateDeliverables } = await ctx.supabase
    .from('subscription_deliverables')
    .select('id, service_id, service_name, service_type, unit, quantity_per_period, notes, position')
    .eq('subscription_id', subscription.id)
    .order('position');

  if (!templateDeliverables || templateDeliverables.length === 0) {
    return { error: 'No hay entregables base' };
  }

  // 5. Crear nuevo período
  const newPeriodNumber = lastPeriod.period_number + 1;
  const { data: newPeriod, error: periodError } = await ctx.supabase
    .from('subscription_periods')
    .insert({
      subscription_id: subscription.id,
      period_number: newPeriodNumber,
      start_date: validation.data.start_date,
      end_date: endDate as string,
      status: 'active',
      started_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (periodError || !newPeriod) {
    return { error: `Error: ${periodError?.message}` };
  }

  // 6. Crear period_deliverables
  const periodDeliverables = templateDeliverables.map((td) => ({
    period_id: newPeriod.id,
    template_deliverable_id: td.id,
    service_id: td.service_id,
    service_name: td.service_name,
    service_type: td.service_type,
    unit: td.unit,
    quantity_planned: td.quantity_per_period,
    notes: td.notes,
    position: td.position,
  }));

  const { error: pdError } = await ctx.supabase
    .from('period_deliverables')
    .insert(periodDeliverables);

  if (pdError) {
    await ctx.supabase
      .from('subscription_periods')
      .delete()
      .eq('id', newPeriod.id);
    return { error: `Error: ${pdError.message}` };
  }

  // 7. Actualizar suscripción
  await ctx.supabase
    .from('client_subscriptions')
    .update({
      current_period_start: validation.data.start_date,
      current_period_end: endDate as string,
      next_renewal_date: endDate as string,
      total_periods_billed: subscription.total_periods_billed + 1,
    })
    .eq('id', subscription.id);

  revalidatePath(`/subscriptions/${subscription.id}`);
  return { success: true, periodId: newPeriod.id };
}

// ============================================================
// PAUSAR SUSCRIPCIÓN
// ============================================================

export async function pauseSubscriptionAction(payload: {
  subscription_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = pauseSubscriptionSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('id', validation.data.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };

  if (subscription.status !== 'active') {
    return { error: `Solo se pueden pausar suscripciones activas` };
  }

  const { error } = await ctx.supabase
    .from('client_subscriptions')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      pause_reason: validation.data.reason.trim(),
    })
    .eq('id', subscription.id);

  if (error) {
    return { error: `Error al pausar: ${error.message}` };
  }

  revalidatePath('/subscriptions');
  revalidatePath(`/subscriptions/${subscription.id}`);
  return { success: true };
}

// ============================================================
// REACTIVAR SUSCRIPCIÓN PAUSADA
// ============================================================

export async function resumeSubscriptionAction(subscriptionId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };

  if (subscription.status !== 'paused') {
    return { error: 'Solo se pueden reactivar suscripciones pausadas' };
  }

  const { error } = await ctx.supabase
    .from('client_subscriptions')
    .update({
      status: 'active',
      paused_at: null,
      pause_reason: null,
    })
    .eq('id', subscription.id);

  if (error) {
    return { error: `Error: ${error.message}` };
  }

  revalidatePath('/subscriptions');
  revalidatePath(`/subscriptions/${subscription.id}`);
  return { success: true };
}

// ============================================================
// CANCELAR SUSCRIPCIÓN
// ============================================================

export async function cancelSubscriptionAction(payload: {
  subscription_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const validation = cancelSubscriptionSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const { data: subscription } = await ctx.supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('id', validation.data.subscription_id)
    .maybeSingle();

  if (!subscription) return { error: 'Suscripción no encontrada' };

  if (subscription.status === 'cancelled') {
    return { error: 'Esta suscripción ya está cancelada' };
  }

  const { error } = await ctx.supabase
    .from('client_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: validation.data.reason.trim(),
      cancelled_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .eq('id', subscription.id);

  if (error) {
    return { error: `Error al cancelar: ${error.message}` };
  }

  revalidatePath('/subscriptions');
  revalidatePath(`/subscriptions/${subscription.id}`);
  return { success: true };
}
