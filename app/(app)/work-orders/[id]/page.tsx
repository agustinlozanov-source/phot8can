import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { getWorkOrderByIdAction } from '@/lib/actions/work-orders';
import { WorkOrderDetail } from './work-order-detail';

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  const canView = hasPermission(ctx, 'work_orders.view');
  const canViewOwn = hasPermission(ctx, 'work_orders.view_own');

  if (!canView && !canViewOwn) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const result = await getWorkOrderByIdAction(id);
  if ('error' in result || !result.workOrder) notFound();

  const supabase = await createClient();
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('organization_id', ctx.organization.id)
    .eq('is_active', true)
    .order('first_name');

  const canManage = hasPermission(ctx, 'work_orders.manage');
  const canCancel = hasPermission(ctx, 'work_orders.cancel');
  const canExecute = hasPermission(ctx, 'work_orders.execute');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Órdenes de trabajo
      </Link>

      <WorkOrderDetail
        workOrder={result.workOrder as never}
        users={(users || []) as never}
        currentUserId={ctx.user?.id ?? null}
        canManage={canManage}
        canCancel={canCancel}
        canExecute={canExecute}
      />
    </div>
  );
}
