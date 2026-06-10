import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { Package, Layers, Plus } from 'lucide-react';
import { ServicesList } from './services-list';
import { NewServiceButton } from './new-service-button';

export default async function ServicesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) {
    redirect('/login');
  }

  // Cualquier miembro del equipo puede ver el catálogo
  // Solo quien tenga config.services puede crearlo/editarlo
  const canManage = hasPermission(ctx, 'config.services');

  const supabase = await createClient();

  // Cargar todos los servicios de la organización
  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar el catálogo
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  const allServices = services || [];

  // Contar por tipo
  const atomicCount = allServices.filter(
    (s) => s.service_type === 'atomic' && !s.archived_at
  ).length;
  const packageCount = allServices.filter(
    (s) => s.service_type === 'package' && !s.archived_at
  ).length;
  const addonCount = allServices.filter(
    (s) => s.service_type === 'addon' && !s.archived_at
  ).length;
  const archivedCount = allServices.filter((s) => s.archived_at).length;

  return (
    <div className="p-8 max-w-7xl">
      {/* Tabs de navegación del catálogo */}
      <CatalogTabs current="services" />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Catálogo
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Servicios y paquetes
          </h1>
          <p className="text-muted-foreground text-sm">
            Todo lo que tu agencia ofrece a sus clientes. {allServices.length}{' '}
            elementos en el catálogo.
          </p>
        </div>

        {canManage && <NewServiceButton />}
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-4 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-8">
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Package className="w-3.5 h-3.5" />
            Servicios
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {atomicCount}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5" />
            Paquetes
          </div>
          <div className="text-2xl font-semibold tracking-tight text-photocan-amber">
            {packageCount}
          </div>
        </div>
        <div className="p-4 border-r border-border">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            <Plus className="w-3.5 h-3.5" />
            Addons
          </div>
          <div className="text-2xl font-semibold tracking-tight">
            {addonCount}
          </div>
        </div>
        <div className="p-4">
          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
            Archivados
          </div>
          <div className="text-2xl font-semibold tracking-tight text-muted-foreground">
            {archivedCount}
          </div>
        </div>
      </div>

      {/* Lista */}
      {allServices.length > 0 ? (
        <ServicesList services={allServices} canManage={canManage} />
      ) : (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Aún no hay servicios</div>
          <div className="text-sm text-muted-foreground mb-4">
            Crea tu primer servicio para empezar a armar el catálogo.
          </div>
          {canManage && <NewServiceButton />}
        </div>
      )}
    </div>
  );
}

// Tabs de navegación del catálogo (servicios / impuestos)
function CatalogTabs({ current }: { current: 'services' | 'taxes' }) {
  return (
    <div className="flex gap-1 border-b border-border mb-8">
      <a
        href="/catalog/services"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          current === 'services'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Package className="w-3.5 h-3.5" />
        Servicios y paquetes
      </a>
      <a
        href="/catalog/taxes"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          (current as string) === 'taxes'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="text-xs font-mono">%</span>
        Impuestos
      </a>
    </div>
  );
}
