'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, Expense, PaymentMethod } from '@/lib/types/database';

type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

// Tipo auxiliar con relaciones para las vistas
export type ExpenseWithRelations = Expense & {
  vendor: { id: string; name: string; is_active: boolean } | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    is_active: boolean;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

const PAYMENT_METHODS = ['transfer', 'cash', 'card', 'check', 'other'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// SCHEMAS
// ============================================================

const createExpenseSchema = z.object({
  vendor_id: z.string().uuid().optional().nullable(),
  vendor_name: z.string().max(200).optional(),
  category_id: z.string().uuid(),
  concept: z.string().min(3, 'El concepto es muy corto').max(200),
  description: z.string().max(1000).optional().nullable(),
  subtotal: z.number().min(0),
  taxes: z.number().min(0).default(0),
  currency: z.string().default('MXN'),
  issue_date: z.string().regex(DATE_RE).optional(),
  due_date: z.string().regex(DATE_RE).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  receipt_url: z.string().url('URL inválida').optional().or(z.literal('')),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['pending', 'paid']).default('pending'),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  paid_at: z.string().optional(),
  paid_amount: z.number().min(0).optional(),
});

const updateExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  vendor_id: z.string().uuid().optional().nullable(),
  vendor_name: z.string().max(200).optional(),
  category_id: z.string().uuid().optional(),
  concept: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  subtotal: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  currency: z.string().optional(),
  due_date: z.string().regex(DATE_RE).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const registerPaymentSchema = z.object({
  expense_id: z.string().uuid(),
  payment_method: z.enum(PAYMENT_METHODS),
  paid_at: z.string().optional(),
  paid_amount: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
  receipt_url: z.string().url().optional().or(z.literal('')),
});

const cancelSchema = z.object({
  expense_id: z.string().uuid(),
  reason: z.string().min(5, 'Indica el motivo (mín. 5 caracteres)').max(500),
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

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// LISTAR GASTOS — permiso: expenses.view
// ============================================================

export async function listExpensesAction(filters?: {
  status?: 'pending' | 'paid' | 'cancelled' | 'all';
  vendor_id?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.view'))) {
    return { error: 'No tienes permiso para ver gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  let query = ctx.supabase
    .from('expenses')
    .select(
      `
      *,
      vendor:vendors!expenses_vendor_id_fkey(id, name, is_active),
      category:expense_categories!expenses_category_id_fkey(id, name, color, icon, is_active),
      creator:users!expenses_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('organization_id', orgId);

  if (filters?.status && filters.status !== 'all')
    query = query.eq('status', filters.status);
  if (filters?.vendor_id) query = query.eq('vendor_id', filters.vendor_id);
  if (filters?.category_id) query = query.eq('category_id', filters.category_id);
  if (filters?.date_from) query = query.gte('issue_date', filters.date_from);
  if (filters?.date_to) query = query.lte('issue_date', filters.date_to);
  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(
      `concept.ilike.%${q}%,vendor_name_snapshot.ilike.%${q}%`
    );
  }

  const { data, error } = await query
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { error: `Error al cargar gastos: ${error.message}` };

  return { expenses: data || [] };
}

// ============================================================
// OBTENER UN GASTO — permiso: expenses.view
// ============================================================

export async function getExpenseByIdAction(id: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.view'))) {
    return { error: 'No tienes permiso para ver gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense, error } = await ctx.supabase
    .from('expenses')
    .select(
      `
      *,
      vendor:vendors!expenses_vendor_id_fkey(*),
      category:expense_categories!expenses_category_id_fkey(id, name, color, icon, is_active),
      creator:users!expenses_created_by_fkey(id, first_name, last_name),
      cancelled_by_user:users!expenses_cancelled_by_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { error: `Error al cargar el gasto: ${error.message}` };
  if (!expense) return { error: 'Gasto no encontrado' };

  return { expense };
}

// ============================================================
// CREAR GASTO — permiso: expenses.manage
// ============================================================

export async function createExpenseAction(payload: {
  vendor_id?: string | null;
  vendor_name?: string;
  category_id: string;
  concept: string;
  description?: string | null;
  subtotal: number;
  taxes?: number;
  currency?: string;
  issue_date?: string;
  due_date?: string | null;
  reference?: string | null;
  receipt_url?: string;
  notes?: string | null;
  status?: 'pending' | 'paid';
  payment_method?: PaymentMethod;
  paid_at?: string;
  paid_amount?: number;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage'))) {
    return { error: 'No tienes permiso para gestionar gastos' };
  }

  const validation = createExpenseSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const d = validation.data;

  // Proveedor: por id o texto libre
  let vendorNameSnapshot: string;
  if (d.vendor_id) {
    const { data: vendor } = await ctx.supabase
      .from('vendors')
      .select('id, organization_id, name')
      .eq('id', d.vendor_id)
      .maybeSingle();
    if (!vendor || vendor.organization_id !== orgId) {
      return { error: 'Proveedor no válido para esta organización' };
    }
    vendorNameSnapshot = vendor.name;
  } else {
    if (!d.vendor_name?.trim()) {
      return { error: 'Indica un proveedor o un nombre de proveedor' };
    }
    vendorNameSnapshot = d.vendor_name.trim();
  }

  // Categoría
  const { data: category } = await ctx.supabase
    .from('expense_categories')
    .select('id, organization_id, name')
    .eq('id', d.category_id)
    .maybeSingle();
  if (!category || category.organization_id !== orgId) {
    return { error: 'Categoría no válida para esta organización' };
  }

  // status paid requiere método de pago
  if (d.status === 'paid' && !d.payment_method) {
    return { error: 'Para registrar como pagado indica el método de pago' };
  }

  // Folio
  const { data: folio, error: folioError } = await ctx.supabase.rpc(
    'generate_expense_folio',
    { p_organization_id: orgId }
  );
  if (folioError || !folio) {
    return { error: 'No se pudo generar el folio' };
  }

  const subtotal = round2(d.subtotal);
  const taxes = round2(d.taxes);
  const total = round2(subtotal + taxes);
  const issueDate = d.issue_date || todayISO();

  const isPaid = d.status === 'paid';

  const { data: expense, error } = await ctx.supabase
    .from('expenses')
    .insert({
      organization_id: orgId,
      folio: folio as string,
      vendor_id: d.vendor_id ?? null,
      vendor_name_snapshot: vendorNameSnapshot,
      category_id: d.category_id,
      category_name_snapshot: category.name,
      concept: d.concept.trim(),
      description: d.description?.trim() || null,
      status: d.status,
      subtotal,
      taxes,
      total,
      currency: d.currency,
      issue_date: issueDate,
      due_date: d.due_date ?? null,
      reference: d.reference?.trim() || null,
      receipt_url: d.receipt_url?.trim() || null,
      notes: d.notes?.trim() || null,
      payment_method: isPaid ? d.payment_method! : null,
      paid_at: isPaid ? d.paid_at || new Date().toISOString() : null,
      paid_amount: isPaid ? (d.paid_amount ?? total) : null,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id, folio')
    .single();

  if (error || !expense) {
    return { error: `Error al crear gasto: ${error?.message}` };
  }

  revalidatePath('/finance/expenses');
  return { success: true, expenseId: expense.id, folio: expense.folio };
}

// ============================================================
// ACTUALIZAR GASTO (solo pending) — permiso: expenses.manage
// ============================================================

export async function updateExpenseAction(payload: {
  expense_id: string;
  vendor_id?: string | null;
  vendor_name?: string;
  category_id?: string;
  concept?: string;
  description?: string | null;
  subtotal?: number;
  taxes?: number;
  currency?: string;
  due_date?: string | null;
  reference?: string | null;
  notes?: string | null;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage'))) {
    return { error: 'No tienes permiso para gestionar gastos' };
  }

  const validation = updateExpenseSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, organization_id, status, subtotal, taxes')
    .eq('id', validation.data.expense_id)
    .maybeSingle();

  if (!expense || expense.organization_id !== orgId) {
    return { error: 'Gasto no encontrado' };
  }
  if (expense.status !== 'pending') {
    return { error: 'Solo se pueden editar gastos pendientes' };
  }

  const d = validation.data;
  const update: ExpenseUpdate = {};

  if (d.concept !== undefined) update.concept = d.concept.trim();
  if (d.description !== undefined)
    update.description = d.description?.trim() || null;
  if (d.currency !== undefined) update.currency = d.currency;
  if (d.due_date !== undefined) update.due_date = d.due_date ?? null;
  if (d.reference !== undefined) update.reference = d.reference?.trim() || null;
  if (d.notes !== undefined) update.notes = d.notes?.trim() || null;

  // Recalcular total si cambia subtotal o taxes
  if (d.subtotal !== undefined || d.taxes !== undefined) {
    const subtotal = round2(d.subtotal ?? expense.subtotal);
    const taxes = round2(d.taxes ?? expense.taxes);
    update.subtotal = subtotal;
    update.taxes = taxes;
    update.total = round2(subtotal + taxes);
  }

  // Cambio de proveedor → actualizar snapshot
  if (d.vendor_id !== undefined) {
    if (d.vendor_id) {
      const { data: vendor } = await ctx.supabase
        .from('vendors')
        .select('id, organization_id, name')
        .eq('id', d.vendor_id)
        .maybeSingle();
      if (!vendor || vendor.organization_id !== orgId) {
        return { error: 'Proveedor no válido' };
      }
      update.vendor_id = vendor.id;
      update.vendor_name_snapshot = vendor.name;
    } else {
      // vendor_id explícito null → texto libre
      update.vendor_id = null;
      if (d.vendor_name?.trim())
        update.vendor_name_snapshot = d.vendor_name.trim();
    }
  } else if (d.vendor_name?.trim()) {
    // Solo cambió el nombre de texto libre
    update.vendor_name_snapshot = d.vendor_name.trim();
  }

  // Cambio de categoría → actualizar snapshot
  if (d.category_id !== undefined) {
    const { data: category } = await ctx.supabase
      .from('expense_categories')
      .select('id, organization_id, name')
      .eq('id', d.category_id)
      .maybeSingle();
    if (!category || category.organization_id !== orgId) {
      return { error: 'Categoría no válida' };
    }
    update.category_id = category.id;
    update.category_name_snapshot = category.name;
  }

  if (Object.keys(update).length === 0) {
    return { error: 'No hay cambios que guardar' };
  }

  const { error } = await ctx.supabase
    .from('expenses')
    .update(update)
    .eq('id', expense.id);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath('/finance/expenses');
  revalidatePath(`/finance/expenses/${expense.id}`);
  return { success: true };
}

// ============================================================
// REGISTRAR PAGO DE GASTO — permiso: expenses.manage
// ============================================================

export async function registerExpensePaymentAction(payload: {
  expense_id: string;
  payment_method: PaymentMethod;
  paid_at?: string;
  paid_amount?: number;
  reference?: string;
  receipt_url?: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage'))) {
    return { error: 'No tienes permiso para gestionar gastos' };
  }

  const validation = registerPaymentSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, organization_id, status, total')
    .eq('id', validation.data.expense_id)
    .maybeSingle();

  if (!expense || expense.organization_id !== orgId) {
    return { error: 'Gasto no encontrado' };
  }
  if (expense.status !== 'pending') {
    return { error: `No se puede pagar un gasto ${expense.status}` };
  }

  const paidAmount = round2(validation.data.paid_amount ?? expense.total);
  if (paidAmount > round2(expense.total) + 0.005) {
    return { error: 'El monto pagado no puede ser mayor al total del gasto' };
  }

  const update: ExpenseUpdate = {
    status: 'paid',
    payment_method: validation.data.payment_method,
    paid_at: validation.data.paid_at || new Date().toISOString(),
    paid_amount: paidAmount,
  };
  if (validation.data.reference?.trim())
    update.reference = validation.data.reference.trim();
  if (validation.data.receipt_url?.trim())
    update.receipt_url = validation.data.receipt_url.trim();

  const { error } = await ctx.supabase
    .from('expenses')
    .update(update)
    .eq('id', expense.id);

  if (error) return { error: `Error al registrar el pago: ${error.message}` };

  revalidatePath('/finance/expenses');
  revalidatePath(`/finance/expenses/${expense.id}`);
  return { success: true };
}

// ============================================================
// CANCELAR GASTO — permiso: expenses.cancel
// ============================================================

export async function cancelExpenseAction(payload: {
  expense_id: string;
  reason: string;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.cancel'))) {
    return { error: 'No tienes permiso para cancelar gastos' };
  }

  const validation = cancelSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, organization_id, status')
    .eq('id', validation.data.expense_id)
    .maybeSingle();

  if (!expense || expense.organization_id !== orgId) {
    return { error: 'Gasto no encontrado' };
  }
  if (expense.status !== 'pending') {
    return { error: `No se puede cancelar un gasto ${expense.status}` };
  }

  const { error } = await ctx.supabase
    .from('expenses')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: ctx.isSuperAdmin ? null : ctx.userId,
      cancellation_reason: validation.data.reason.trim(),
    })
    .eq('id', expense.id);

  if (error) return { error: `Error al cancelar: ${error.message}` };

  revalidatePath('/finance/expenses');
  revalidatePath(`/finance/expenses/${expense.id}`);
  return { success: true };
}

// ============================================================
// DESMARCAR COMO PAGADO — permiso: expenses.manage
// ============================================================

export async function unmarkAsPaidAction(expenseId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('expenses.manage'))) {
    return { error: 'No tienes permiso para gestionar gastos' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, organization_id, status')
    .eq('id', expenseId)
    .maybeSingle();

  if (!expense || expense.organization_id !== orgId) {
    return { error: 'Gasto no encontrado' };
  }
  if (expense.status !== 'paid') {
    return { error: 'Este gasto no está marcado como pagado' };
  }

  // Mantiene reference para histórico; limpia el resto del pago
  const { error } = await ctx.supabase
    .from('expenses')
    .update({
      status: 'pending',
      paid_at: null,
      paid_amount: null,
      payment_method: null,
    })
    .eq('id', expense.id);

  if (error) return { error: `Error: ${error.message}` };

  revalidatePath('/finance/expenses');
  revalidatePath(`/finance/expenses/${expense.id}`);
  return { success: true };
}

// ============================================================
// BORRAR GASTO — Super Admin o (expenses.manage + cancelado)
// ============================================================

export async function deleteExpenseAction(expenseId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: expense } = await ctx.supabase
    .from('expenses')
    .select('id, organization_id, status')
    .eq('id', expenseId)
    .maybeSingle();

  if (!expense || expense.organization_id !== orgId) {
    return { error: 'Gasto no encontrado' };
  }

  if (!ctx.isSuperAdmin) {
    if (!(await checkPermission('expenses.manage'))) {
      return { error: 'No tienes permiso para borrar gastos' };
    }
    if (expense.status !== 'cancelled') {
      return { error: 'Solo se pueden borrar gastos cancelados' };
    }
  }

  const { error } = await ctx.supabase
    .from('expenses')
    .delete()
    .eq('id', expense.id)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al borrar: ${error.message}` };

  console.log(
    `[deleteExpense] Gasto ${expenseId} borrado por ${
      ctx.isSuperAdmin ? 'super-admin' : ctx.userId
    }`
  );

  revalidatePath('/finance/expenses');
  return { success: true };
}
