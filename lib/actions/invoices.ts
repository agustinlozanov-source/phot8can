'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, InvoiceStatus, PaymentMethod } from '@/lib/types/database';

type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

// ============================================================
// CONSTANTES
// ============================================================

const PAYMENT_METHODS = [
  'transfer',
  'cash',
  'card',
  'check',
  'other',
] as const;

// ============================================================
// SCHEMAS
// ============================================================

const createManualSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(3, 'El título es muy corto').max(200),
  description: z.string().max(1000).optional(),
  subtotal: z.number().min(0),
  taxes: z.number().min(0).default(0),
  currency: z.string().default('MXN'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

const registerPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().min(0),
  payment_method: z.enum(PAYMENT_METHODS),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(200).optional(),
  receipt_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

const cancelInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().min(5, 'Indica el motivo (mín. 5 caracteres)').max(500),
});

const updateInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(1000).optional().nullable(),
  subtotal: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================
// LISTAR INVOICES
// ============================================================

export async function listInvoicesAction(filters?: {
  status?: InvoiceStatus | 'all';
  client_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.view'))) {
    return { error: 'No tienes permiso para ver finanzas' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // Marcar como overdue los pendientes vencidos antes de listar
  await ctx.supabase.rpc('mark_overdue_invoices');

  let query = ctx.supabase
    .from('invoices')
    .select(
      `
      *,
      client:clients(id, name, legal_name),
      creator:users!invoices_created_by_fkey(id, first_name, last_name),
      payment:payments!payments_invoice_id_fkey(id, amount, payment_method, payment_date)
    `
    )
    .eq('organization_id', orgId);

  if (filters?.status && filters.status !== 'all')
    query = query.eq('status', filters.status);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.date_from) query = query.gte('issue_date', filters.date_from);
  if (filters?.date_to) query = query.lte('issue_date', filters.date_to);

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) return { error: `Error al cargar facturas: ${error.message}` };

  return { invoices: data || [] };
}

// ============================================================
// OBTENER UN INVOICE
// ============================================================

export async function getInvoiceByIdAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.view'))) {
    return { error: 'No tienes permiso para ver finanzas' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: invoice, error } = await ctx.supabase
    .from('invoices')
    .select(
      `
      *,
      client:clients(id, name, legal_name, tax_id, address),
      creator:users!invoices_created_by_fkey(id, first_name, last_name),
      payment:payments!payments_invoice_id_fkey(*),
      source_period:subscription_periods!invoices_source_subscription_period_id_fkey(
        id, period_number, start_date, end_date,
        subscription:client_subscriptions!subscription_periods_subscription_id_fkey(id, name)
      )
    `
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { error: `Error al cargar la factura: ${error.message}` };
  if (!invoice) return { error: 'Factura no encontrada' };

  return { invoice };
}

// ============================================================
// CREAR INVOICE MANUAL
// ============================================================

export async function createManualInvoiceAction(payload: {
  client_id: string;
  title: string;
  description?: string;
  subtotal: number;
  taxes?: number;
  currency?: string;
  due_date: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.manage'))) {
    return { error: 'No tienes permiso para gestionar finanzas' };
  }

  const validation = createManualSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // due_date no puede ser anterior a hoy
  const today = new Date().toISOString().split('T')[0];
  if (validation.data.due_date < today) {
    return { error: 'La fecha de vencimiento no puede ser en el pasado' };
  }

  // Validar cliente y org
  const { data: client } = await ctx.supabase
    .from('clients')
    .select('id, organization_id')
    .eq('id', validation.data.client_id)
    .maybeSingle();

  if (!client || client.organization_id !== orgId) {
    return { error: 'Cliente no válido para esta organización' };
  }

  // Folio
  const { data: folio, error: folioError } = await ctx.supabase.rpc(
    'generate_invoice_folio',
    { p_organization_id: orgId }
  );
  if (folioError || !folio) {
    return { error: 'No se pudo generar el folio' };
  }

  const subtotal = round2(validation.data.subtotal);
  const taxes = round2(validation.data.taxes);
  const total = round2(subtotal + taxes);

  const { data: invoice, error: insertError } = await ctx.supabase
    .from('invoices')
    .insert({
      organization_id: orgId,
      client_id: validation.data.client_id,
      source: 'manual',
      source_subscription_period_id: null,
      folio: folio as string,
      title: validation.data.title.trim(),
      description: validation.data.description?.trim() || null,
      status: 'pending',
      subtotal,
      taxes,
      total,
      currency: validation.data.currency,
      issue_date: today,
      due_date: validation.data.due_date,
      notes: validation.data.notes?.trim() || null,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, folio')
    .single();

  if (insertError || !invoice) {
    return { error: `Error al crear factura: ${insertError?.message}` };
  }

  revalidatePath('/finance');
  return { success: true, invoiceId: invoice.id, folio: invoice.folio };
}

// ============================================================
// REGISTRAR PAGO
// ============================================================

export async function registerPaymentAction(payload: {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference?: string;
  receipt_url?: string;
  notes?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.manage'))) {
    return { error: 'No tienes permiso para gestionar finanzas' };
  }

  const validation = registerPaymentSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  // payment_date no puede ser futuro
  const today = new Date().toISOString().split('T')[0];
  if (validation.data.payment_date > today) {
    return { error: 'La fecha de pago no puede ser en el futuro' };
  }

  const { data: invoice } = await ctx.supabase
    .from('invoices')
    .select('id, organization_id, status, total, client_id, currency')
    .eq('id', validation.data.invoice_id)
    .maybeSingle();

  if (!invoice || invoice.organization_id !== orgId) {
    return { error: 'Factura no encontrada' };
  }

  if (!['pending', 'overdue'].includes(invoice.status)) {
    return {
      error: `No se puede registrar un pago en una factura ${invoice.status}`,
    };
  }

  // Solo pagos exactos (no parciales)
  if (Math.abs(round2(validation.data.amount) - round2(invoice.total)) > 0.005) {
    return {
      error: `El monto debe ser exactamente ${invoice.total}. Para cobros parciales contacta a desarrollo.`,
    };
  }

  const { data: payment, error: payError } = await ctx.supabase
    .from('payments')
    .insert({
      invoice_id: invoice.id,
      amount: round2(validation.data.amount),
      currency: invoice.currency,
      payment_method: validation.data.payment_method,
      payment_date: validation.data.payment_date,
      reference: validation.data.reference?.trim() || null,
      receipt_url: validation.data.receipt_url?.trim() || null,
      notes: validation.data.notes?.trim() || null,
      recorded_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (payError || !payment) {
    if (payError?.code === '23505') {
      return { error: 'Esta factura ya tiene un pago registrado' };
    }
    return { error: `Error al registrar el pago: ${payError?.message}` };
  }

  const { error: updateError } = await ctx.supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_amount: round2(validation.data.amount),
    })
    .eq('id', invoice.id);

  if (updateError) {
    return { error: `Pago registrado pero falló actualizar la factura: ${updateError.message}` };
  }

  revalidatePath('/finance');
  revalidatePath(`/finance/${invoice.id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
  return { success: true, paymentId: payment.id };
}

// ============================================================
// CANCELAR INVOICE
// ============================================================

export async function cancelInvoiceAction(payload: {
  invoice_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.cancel'))) {
    return { error: 'No tienes permiso para cancelar facturas' };
  }

  const validation = cancelInvoiceSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: invoice } = await ctx.supabase
    .from('invoices')
    .select('id, organization_id, status')
    .eq('id', validation.data.invoice_id)
    .maybeSingle();

  if (!invoice || invoice.organization_id !== orgId) {
    return { error: 'Factura no encontrada' };
  }

  if (!['pending', 'overdue'].includes(invoice.status)) {
    return { error: `No se puede cancelar una factura ${invoice.status}` };
  }

  // Si tiene un pago registrado, no cancelar
  const { data: payment } = await ctx.supabase
    .from('payments')
    .select('id')
    .eq('invoice_id', invoice.id)
    .maybeSingle();

  if (payment) {
    return {
      error:
        'No se puede cancelar una factura con pago registrado. Reverte el pago primero.',
    };
  }

  const { error } = await ctx.supabase
    .from('invoices')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: ctx.isSuperAdmin ? null : ctx.userId,
      cancellation_reason: validation.data.reason.trim(),
    })
    .eq('id', invoice.id);

  if (error) return { error: `Error al cancelar: ${error.message}` };

  revalidatePath('/finance');
  revalidatePath(`/finance/${invoice.id}`);
  return { success: true };
}

// ============================================================
// ACTUALIZAR INVOICE (solo pending)
// ============================================================

export async function updateInvoiceAction(payload: {
  invoice_id: string;
  title?: string;
  description?: string | null;
  due_date?: string;
  notes?: string | null;
  subtotal?: number;
  taxes?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.manage'))) {
    return { error: 'No tienes permiso para gestionar finanzas' };
  }

  const validation = updateInvoiceSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: invoice } = await ctx.supabase
    .from('invoices')
    .select('id, organization_id, status, subtotal, taxes')
    .eq('id', validation.data.invoice_id)
    .maybeSingle();

  if (!invoice || invoice.organization_id !== orgId) {
    return { error: 'Factura no encontrada' };
  }

  if (invoice.status !== 'pending') {
    return { error: 'Solo se pueden editar facturas pendientes' };
  }

  const { invoice_id, ...fields } = validation.data;

  const update: InvoiceUpdate = {};
  if (fields.title !== undefined) update.title = fields.title.trim();
  if (fields.description !== undefined)
    update.description = fields.description?.trim() || null;
  if (fields.due_date !== undefined) update.due_date = fields.due_date;
  if (fields.notes !== undefined) update.notes = fields.notes?.trim() || null;

  // Recalcular total si cambia subtotal o taxes
  if (fields.subtotal !== undefined || fields.taxes !== undefined) {
    const subtotal = round2(
      fields.subtotal !== undefined ? fields.subtotal : invoice.subtotal
    );
    const taxes = round2(
      fields.taxes !== undefined ? fields.taxes : invoice.taxes
    );
    update.subtotal = subtotal;
    update.taxes = taxes;
    update.total = round2(subtotal + taxes);
  }

  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('invoices')
    .update(update)
    .eq('id', invoice_id);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath('/finance');
  revalidatePath(`/finance/${invoice_id}`);
  return { success: true };
}

// ============================================================
// BORRAR PAGO (corrección)
// ============================================================

export async function deletePaymentAction(paymentId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!ctx.isSuperAdmin && !(await checkPermission('finance.manage'))) {
    return { error: 'No tienes permiso para gestionar finanzas' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: payment } = await ctx.supabase
    .from('payments')
    .select(
      `
      id,
      invoice:invoices!payments_invoice_id_fkey(id, organization_id, client_id)
    `
    )
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return { error: 'Pago no encontrado' };

  const invoice = payment.invoice as unknown as {
    id: string;
    organization_id: string;
    client_id: string;
  } | null;

  if (!invoice || invoice.organization_id !== orgId) {
    return { error: 'Pago no encontrado' };
  }

  const { error: delError } = await ctx.supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (delError) return { error: `Error al borrar el pago: ${delError.message}` };

  // Revertir la factura a pendiente
  const { error: updateError } = await ctx.supabase
    .from('invoices')
    .update({ status: 'pending', paid_at: null, paid_amount: null })
    .eq('id', invoice.id);

  if (updateError) {
    return { error: `Pago borrado pero falló revertir la factura: ${updateError.message}` };
  }

  revalidatePath('/finance');
  revalidatePath(`/finance/${invoice.id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
  return { success: true };
}

// ============================================================
// FORZAR CHEQUEO DE VENCIDAS
// ============================================================

export async function retryOverdueCheckAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('finance.view'))) {
    return { error: 'No tienes permiso para ver finanzas' };
  }

  const { data, error } = await ctx.supabase.rpc('mark_overdue_invoices');
  if (error) return { error: error.message };

  revalidatePath('/finance');
  return { count: (data as number) ?? 0 };
}
