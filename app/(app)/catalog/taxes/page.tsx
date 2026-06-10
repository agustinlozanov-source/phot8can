import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { Package, Percent } from 'lucide-react';
import { TaxesList } from './taxes-list';

export default async function TaxesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  const canManage = hasPermission(ctx, 'config.taxes');

  const supabase = await createClient();

  const { data: taxes, error } = await supabase
    .from('taxes')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar impuestos
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <CatalogTabs current="taxes" />

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Catálogo
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Impuestos
          </h1>
          <p className="text-muted-foreground text-sm">
            Configuración de impuestos aplicables a tus cotizaciones.{' '}
            {taxes?.length ?? 0} configurados.
          </p>
        </div>
      </div>

      <TaxesList taxes={taxes || []} canManage={canManage} />
    </div>
  );
}

function CatalogTabs({ current }: { current: 'services' | 'taxes' }) {
  return (
    <div className="flex gap-1 border-b border-border mb-8">
      <a
        href="/catalog/services"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          (current as string) === 'services'
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
          current === 'taxes'
            ? 'border-photocan-amber text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Percent className="w-3.5 h-3.5" />
        Impuestos
      </a>
    </div>
  );
}
