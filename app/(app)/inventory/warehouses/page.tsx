import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { WarehousesList } from './warehouses-list';

export default async function WarehousesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'inventory.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver almacenes.
          </div>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(ctx, 'inventory.manage_warehouses');

  const supabase = await createClient();

  const { data: warehouses, error } = await supabase
    .from('warehouses')
    .select(
      `
      *,
      assigned_user:users!warehouses_assigned_to_user_id_fkey(id, first_name, last_name)
    `
    )
    .order('is_active', { ascending: false })
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('name');

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar almacenes
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  // Conteo de activos por almacén
  const { data: assetCounts } = await supabase
    .from('assets')
    .select('current_warehouse_id')
    .is('archived_at', null);

  const countByWarehouse: Record<string, number> = {};
  for (const a of assetCounts || []) {
    if (a.current_warehouse_id) {
      countByWarehouse[a.current_warehouse_id] =
        (countByWarehouse[a.current_warehouse_id] || 0) + 1;
    }
  }

  // Cargar usuarios activos para selector de almacenes personales
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Inventario
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Almacenes
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Ubicaciones de equipo
        </h1>
        <p className="text-muted-foreground text-sm">
          Cada activo siempre vive en un almacén. Pueden ser estuches, bodegas
          o lockers personales.
        </p>
      </div>

      <WarehousesList
        warehouses={(warehouses || []) as never}
        assetCounts={countByWarehouse}
        users={users || []}
        canManage={canManage}
      />
    </div>
  );
}
