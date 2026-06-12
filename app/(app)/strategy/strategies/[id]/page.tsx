import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { StrategyDetail } from './strategy-detail';

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

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

  const { data: strategy } = await supabase
    .from('strategies')
    .select(
      `
      *,
      client:clients(id, name, legal_name),
      interview:interviews(id, mode, completed_at, duration_seconds),
      creator:users!strategies_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!strategy) notFound();

  // Cargar las 7 capas
  const { data: layers } = await supabase
    .from('strategy_layers')
    .select(
      `
      *,
      reviewer:users!strategy_layers_reviewed_by_fkey(id, first_name, last_name)
    `
    )
    .eq('strategy_id', id)
    .order('layer_order', { ascending: true });

  const canReview = hasPermission(ctx, 'strategy.view');
  const canApprove = hasPermission(ctx, 'strategy.view');
  const canRegenerate = hasPermission(ctx, 'strategy.view');

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/strategy/strategies"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Estrategias
      </Link>

      <StrategyDetail
        strategy={strategy as never}
        layers={(layers || []) as never}
        canReview={canReview}
        canApprove={canApprove}
        canRegenerate={canRegenerate}
      />
    </div>
  );
}
