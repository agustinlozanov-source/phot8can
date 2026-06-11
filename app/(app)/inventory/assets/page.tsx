import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { AssetsList } from './assets-list';
import { Button } from '@/components/ui/button';

export default async function AssetsPage() {
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
            No tienes permiso para ver activos.
          </div>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(ctx, 'inventory.manage_assets');

  const supabase = await createClient();

  const { data: assets } = await supabase
    .from('assets')
    .select(
      `
      *,
      warehouse:warehouses!assets_current_warehouse_id_fkey(id, name, type),
      holder:users!assets_current_holder_id_fkey(id, first_name, last_name)
    `
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Inventario
      </Link>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Activos
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Equipos individuales
          </h1>
          <p className="text-muted-foreground text-sm">
            {(assets || []).length} activos registrados
          </p>
        </div>

        {canManage && (
          <Link href="/inventory/assets/new">
            <Button>
              <Plus className="w-4 h-4" />
              Nuevo activo
            </Button>
          </Link>
        )}
      </div>

      {(assets || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin activos registrados</div>
          <div className="text-sm text-muted-foreground mb-4">
            Empieza registrando tu primera cámara, lente o memoria SD.
          </div>
          {canManage && (
            <Link href="/inventory/assets/new">
              <Button>
                <Plus className="w-4 h-4" />
                Crear primer activo
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <AssetsList assets={(assets || []) as never} />
      )}
    </div>
  );
}
