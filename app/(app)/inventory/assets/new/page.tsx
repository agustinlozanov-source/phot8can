import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { AssetForm } from '../asset-form';

export default async function NewAssetPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'inventory.manage_assets')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para crear activos.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, type')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name');

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/inventory/assets"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Activos
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Nuevo activo
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Registrar activo
        </h1>
        <p className="text-muted-foreground text-sm">
          Cada activo es individual. Si tienes 5 memorias SD iguales, son 5
          registros distintos.
        </p>
      </div>

      <AssetForm mode="create" warehouses={warehouses || []} />
    </div>
  );
}
