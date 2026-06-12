import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { StrategiesList } from './strategies-list';

export default async function StrategiesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'strategy.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: strategies } = await supabase
    .from('strategies')
    .select(
      `
      *,
      client:clients(id, name),
      creator:users!strategies_created_by_fkey(id, first_name, last_name)
    `
    )
    .order('created_at', { ascending: false });

  // Conteo de capas aprobadas por estrategia
  const strategyIds = (strategies || []).map((s) => s.id);
  const { data: layersData } = await supabase
    .from('strategy_layers')
    .select('strategy_id, status')
    .in('strategy_id', strategyIds);

  const layersByStrategy: Record<string, { total: number; approved: number }> = {};

  for (const layer of layersData || []) {
    if (!layersByStrategy[layer.strategy_id]) {
      layersByStrategy[layer.strategy_id] = { total: 0, approved: 0 };
    }
    layersByStrategy[layer.strategy_id].total++;
    if (layer.status === 'approved') {
      layersByStrategy[layer.strategy_id].approved++;
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <Link
        href="/strategy"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Estrategia
      </Link>

      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Estrategias
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Documentos estratégicos
        </h1>
        <p className="text-muted-foreground text-sm">
          {(strategies || []).length} estrategias en total
        </p>
      </div>

      {(strategies || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin estrategias todavía</div>
          <div className="text-sm text-muted-foreground mb-4">
            Las estrategias se generan automáticamente cuando un cliente
            completa su entrevista. Cada estrategia tiene 7 capas que debes
            revisar antes de enviar al cliente.
          </div>
          <Link
            href="/strategy/interviews"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber-deep hover:underline"
          >
            Ver entrevistas
          </Link>
        </div>
      ) : (
        <StrategiesList
          strategies={(strategies || []) as never}
          layersByStrategy={layersByStrategy}
        />
      )}
    </div>
  );
}
