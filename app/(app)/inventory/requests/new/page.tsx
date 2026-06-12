import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { NewRequestForm } from './new-request-form';

export default async function NewRequestPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!hasPermission(ctx, 'inventory.request_assets')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para crear solicitudes.
          </div>
        </div>
      </div>
    );
  }

  if (ctx.isSuperAdmin && !ctx.organization) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Super Admin sin impersonación</div>
          <div className="text-sm text-muted-foreground">
            Las solicitudes solo pueden crearse desde una organización. Activa
            impersonación primero.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Cargar activos disponibles
  const { data: assets } = await supabase
    .from('assets')
    .select(
      `
      id, name, brand, model, serial_number, category, status,
      warehouse:warehouses!assets_current_warehouse_id_fkey(id, name)
    `
    )
    .is('archived_at', null)
    .in('status', ['available'])
    .order('category')
    .order('name');

  // Cargar clientes activos (opcional)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .is('archived_at', null)
    .eq('status', 'active')
    .order('name');

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/inventory/requests"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Solicitudes
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Nueva solicitud
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Solicitar equipo
        </h1>
        <p className="text-muted-foreground text-sm">
          Selecciona los activos que necesitas y describe el propósito. Un
          aprobador revisará tu solicitud.
        </p>
      </div>

      <NewRequestForm
        availableAssets={(assets || []) as never}
        clients={clients || []}
      />
    </div>
  );
}
