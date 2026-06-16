'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// CONSTANTES
// ============================================================

const ITEM_TYPES = [
  'post',
  'reel',
  'story',
  'carousel',
  'video',
  'live',
  'other',
] as const;

const STAGE_TYPES = [
  'design',
  'edit',
  'copy',
  'review',
  'shoot',
  'other',
] as const;

// Orden lógico de las etapas dentro de una OT (para position)
const STAGE_ORDER: Record<string, number> = {
  design: 0,
  shoot: 0,
  edit: 1,
  copy: 2,
  review: 3,
  other: 4,
};

// ============================================================
// SCHEMAS
// ============================================================

const upsertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  item_type: z.enum(ITEM_TYPES),
  stage_type: z.enum(STAGE_TYPES),
  default_user_id: z.string().uuid().optional().nullable(),
  stage_name_template: z.string().min(1).max(200),
  default_days_before_publish: z.number().int().min(1).max(30).default(3),
  default_estimated_hours: z.number().min(0).max(100).optional().nullable(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
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

async function checkPermission(code: string): Promise<boolean> {
  const { getActiveContext, hasPermission } = await import(
    '@/lib/auth/context'
  );
  const authCtx = await getActiveContext();
  return hasPermission(authCtx, code);
}

// ============================================================
// LISTAR REGLAS
// ============================================================

export async function listAssignmentRulesAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data, error } = await ctx.supabase
    .from('assignment_rules')
    .select(
      `
      *,
      default_user:users!assignment_rules_default_user_id_fkey(id, first_name, last_name)
    `
    )
    .eq('organization_id', orgId)
    .order('position')
    .order('item_type')
    .order('stage_type');

  if (error) return { error: `Error al cargar reglas: ${error.message}` };

  return { rules: data || [] };
}

// ============================================================
// CREAR / ACTUALIZAR REGLA
// ============================================================

export async function upsertAssignmentRuleAction(payload: {
  id?: string;
  item_type: (typeof ITEM_TYPES)[number];
  stage_type: (typeof STAGE_TYPES)[number];
  default_user_id?: string | null;
  stage_name_template: string;
  default_days_before_publish?: number;
  default_estimated_hours?: number | null;
  position?: number;
  is_active?: boolean;
}) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('work_orders.manage_rules'))) {
    return { error: 'No tienes permiso para gestionar reglas de asignación' };
  }

  const validation = upsertRuleSchema.safeParse(payload);
  if (!validation.success) {
    return { error: validation.error.errors[0].message };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { id, ...data } = validation.data;

  const ruleData = {
    organization_id: orgId,
    item_type: data.item_type,
    stage_type: data.stage_type,
    default_user_id: data.default_user_id ?? null,
    stage_name_template: data.stage_name_template.trim(),
    default_days_before_publish: data.default_days_before_publish,
    default_estimated_hours: data.default_estimated_hours ?? null,
    position: data.position,
    is_active: data.is_active,
    updated_by: ctx.isSuperAdmin ? null : ctx.userId,
  };

  // UPDATE explícito si viene id
  if (id) {
    const { error } = await ctx.supabase
      .from('assignment_rules')
      .update(ruleData)
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) return { error: `Error al actualizar regla: ${error.message}` };

    revalidatePath('/work-orders/rules');
    return { success: true, id };
  }

  // INSERT — puede chocar con el UNIQUE (org, item_type, stage_type)
  const { data: inserted, error: insertError } = await ctx.supabase
    .from('assignment_rules')
    .insert({
      ...ruleData,
      created_by: ctx.isSuperAdmin ? null : ctx.userId,
    })
    .select('id')
    .single();

  if (!insertError && inserted) {
    revalidatePath('/work-orders/rules');
    return { success: true, id: inserted.id };
  }

  // Si fue violación de UNIQUE, hacer UPDATE por el combo
  if (insertError?.code === '23505') {
    const { data: updated, error: updateError } = await ctx.supabase
      .from('assignment_rules')
      .update(ruleData)
      .eq('organization_id', orgId)
      .eq('item_type', data.item_type)
      .eq('stage_type', data.stage_type)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      return {
        error: `Ya existe una regla para ${data.item_type}/${data.stage_type} y no se pudo actualizar`,
      };
    }

    revalidatePath('/work-orders/rules');
    return { success: true, id: updated.id };
  }

  return { error: `Error al crear regla: ${insertError?.message}` };
}

// ============================================================
// BORRAR REGLA
// ============================================================

export async function deleteAssignmentRuleAction(ruleId: string) {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('work_orders.manage_rules'))) {
    return { error: 'No tienes permiso para gestionar reglas de asignación' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { error } = await ctx.supabase
    .from('assignment_rules')
    .delete()
    .eq('id', ruleId)
    .eq('organization_id', orgId);

  if (error) return { error: `Error al borrar regla: ${error.message}` };

  revalidatePath('/work-orders/rules');
  return { success: true };
}

// ============================================================
// SEED DE REGLAS BASE (idempotente)
// ============================================================

export async function seedDefaultAssignmentRulesAction() {
  const ctx = await getContext();
  if ('error' in ctx) return { error: ctx.error };

  if (!(await checkPermission('work_orders.manage_rules'))) {
    return { error: 'No tienes permiso para gestionar reglas de asignación' };
  }

  const orgId = resolveOrgId(ctx);
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const defaults: Array<{
    item_type: (typeof ITEM_TYPES)[number];
    stage_type: (typeof STAGE_TYPES)[number];
    days: number;
    name: string;
  }> = [
    { item_type: 'post', stage_type: 'design', days: 3, name: 'Diseño del post' },
    { item_type: 'post', stage_type: 'copy', days: 5, name: 'Copy del post' },
    { item_type: 'post', stage_type: 'review', days: 1, name: 'Revisión final' },
    { item_type: 'reel', stage_type: 'design', days: 5, name: 'Diseño visual del reel' },
    { item_type: 'reel', stage_type: 'edit', days: 3, name: 'Edición del reel' },
    { item_type: 'reel', stage_type: 'copy', days: 5, name: 'Copy del reel' },
    { item_type: 'reel', stage_type: 'review', days: 1, name: 'Revisión final' },
    { item_type: 'story', stage_type: 'design', days: 1, name: 'Diseño del story' },
    { item_type: 'carousel', stage_type: 'design', days: 4, name: 'Diseño del carrusel' },
    { item_type: 'carousel', stage_type: 'copy', days: 5, name: 'Copy del carrusel' },
    { item_type: 'carousel', stage_type: 'review', days: 1, name: 'Revisión final' },
    { item_type: 'video', stage_type: 'edit', days: 5, name: 'Edición del video' },
    { item_type: 'video', stage_type: 'copy', days: 5, name: 'Copy del video' },
    { item_type: 'video', stage_type: 'review', days: 1, name: 'Revisión final' },
  ];

  const rows = defaults.map((d) => ({
    organization_id: orgId,
    item_type: d.item_type,
    stage_type: d.stage_type,
    default_user_id: null,
    stage_name_template: d.name,
    default_days_before_publish: d.days,
    default_estimated_hours: null,
    position: STAGE_ORDER[d.stage_type] ?? 0,
    is_active: true,
    created_by: ctx.isSuperAdmin ? null : ctx.userId,
    updated_by: ctx.isSuperAdmin ? null : ctx.userId,
  }));

  const { error } = await ctx.supabase
    .from('assignment_rules')
    .upsert(rows, {
      onConflict: 'organization_id,item_type,stage_type',
      ignoreDuplicates: true,
    });

  if (error) return { error: `Error al crear reglas base: ${error.message}` };

  revalidatePath('/work-orders/rules');
  return { success: true, seeded: rows.length };
}
