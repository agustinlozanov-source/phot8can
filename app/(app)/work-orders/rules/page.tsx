import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { listAssignmentRulesAction } from '@/lib/actions/assignment-rules';
import { RulesConfig } from './rules-config';

export default async function WorkOrderRulesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'work_orders.manage_rules')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para configurar reglas de asignación.
          </div>
        </div>
      </div>
    );
  }

  const result = await listAssignmentRulesAction();
  const rules = ('rules' in result ? result.rules : []) ?? [];

  const supabase = await createClient();
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('organization_id', ctx.organization.id)
    .eq('is_active', true)
    .order('first_name');

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Órdenes de trabajo
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Configuración
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
          <Settings className="w-7 h-7 text-photocan-amber" />
          Reglas de asignación
        </h1>
        <p className="text-muted-foreground text-sm">
          Define qué tareas y responsables se generan automáticamente al
          convertir piezas del cronograma en órdenes de trabajo.
        </p>
      </div>

      <RulesConfig
        rules={rules as never}
        users={(users || []) as never}
      />
    </div>
  );
}
