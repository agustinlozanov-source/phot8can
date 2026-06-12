import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Boxes } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { RequestsList } from './requests-list';
import { Button } from '@/components/ui/button';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
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
            No tienes permiso para ver solicitudes.
          </div>
        </div>
      </div>
    );
  }

  const canRequest = hasPermission(ctx, 'inventory.request_assets');

  const supabase = await createClient();

  const { data: requests } = await supabase
    .from('asset_requests')
    .select(
      `
      *,
      requester:users!asset_requests_requested_by_fkey(id, first_name, last_name),
      decider:users!asset_requests_decided_by_fkey(id, first_name, last_name),
      client:clients(id, name)
    `
    )
    .order('created_at', { ascending: false });

  // Conteo de items por solicitud
  const requestIds = (requests || []).map((r) => r.id);
  const { data: itemCounts } = await supabase
    .from('asset_request_items')
    .select('request_id, return_at')
    .in('request_id', requestIds);

  const itemsByRequest: Record<string, { total: number; returned: number }> =
    {};
  for (const item of itemCounts || []) {
    if (!itemsByRequest[item.request_id]) {
      itemsByRequest[item.request_id] = { total: 0, returned: 0 };
    }
    itemsByRequest[item.request_id].total++;
    if (item.return_at) {
      itemsByRequest[item.request_id].returned++;
    }
  }

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
            Solicitudes
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Pedidos de equipo
          </h1>
          <p className="text-muted-foreground text-sm">
            {(requests || []).length} solicitudes en total
          </p>
        </div>

        {canRequest && (
          <Link href="/inventory/requests/new">
            <Button>
              <Plus className="w-4 h-4" />
              Nueva solicitud
            </Button>
          </Link>
        )}
      </div>

      {(requests || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Boxes className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin solicitudes</div>
          <div className="text-sm text-muted-foreground mb-4">
            Las solicitudes son la forma en que el equipo pide equipo prestado
            para sus proyectos.
          </div>
          {canRequest && (
            <Link href="/inventory/requests/new">
              <Button>
                <Plus className="w-4 h-4" />
                Crear primera solicitud
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <RequestsList
          requests={(requests || []) as never}
          itemsByRequest={itemsByRequest}
          initialFilter={filter}
        />
      )}
    </div>
  );
}
