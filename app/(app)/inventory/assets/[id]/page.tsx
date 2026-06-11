import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { AssetDetail } from './asset-detail';

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'inventory.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: asset } = await supabase
    .from('assets')
    .select(
      `
      *,
      warehouse:warehouses!assets_current_warehouse_id_fkey(id, name, type),
      holder:users!assets_current_holder_id_fkey(id, first_name, last_name, email)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!asset) notFound();

  // Historial completo
  const { data: movements } = await supabase
    .from('asset_movements')
    .select(
      `
      *,
      from_warehouse:warehouses!asset_movements_from_warehouse_id_fkey(id, name),
      to_warehouse:warehouses!asset_movements_to_warehouse_id_fkey(id, name),
      from_user:users!asset_movements_from_user_id_fkey(id, first_name, last_name),
      to_user:users!asset_movements_to_user_id_fkey(id, first_name, last_name),
      performer:users!asset_movements_performed_by_fkey(id, first_name, last_name)
    `
    )
    .eq('asset_id', id)
    .order('created_at', { ascending: false });

  // Almacenes activos para selectores
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, type')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name');

  const canManage = hasPermission(ctx, 'inventory.manage_assets');

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/inventory/assets"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Activos
      </Link>

      <AssetDetail
        asset={asset as never}
        movements={(movements || []) as never}
        warehouses={warehouses || []}
        canManage={canManage}
      />
    </div>
  );
}
