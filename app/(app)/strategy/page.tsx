import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  MessageSquare,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';

export default async function StrategyDashboardPage() {
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
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver el módulo de estrategia.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [interviewsResult, strategiesResult] = await Promise.all([
    supabase
      .from('interviews')
      .select('id, status', { count: 'exact' }),
    supabase
      .from('strategies')
      .select('id, status', { count: 'exact' }),
  ]);

  const interviews = interviewsResult.data || [];
  const strategies = strategiesResult.data || [];

  const pendingInterviews = interviews.filter((i) => i.status === 'pending').length;
  const inProgressInterviews = interviews.filter((i) => i.status === 'in_progress').length;
  const completedInterviews = interviews.filter((i) =>
    ['completed', 'processing'].includes(i.status)
  ).length;

  const draftStrategies = strategies.filter((s) =>
    ['draft', 'review'].includes(s.status)
  ).length;
  const sentStrategies = strategies.filter((s) =>
    ['sent', 'viewed'].includes(s.status)
  ).length;
  const approvedStrategies = strategies.filter((s) => s.status === 'approved').length;

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
          Estrategia con IA
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Entrevistas y estrategias
        </h1>
        <p className="text-muted-foreground text-sm">
          Entrevistas conversacionales con Lía + estrategias en 7 capas
          generadas por Claude.
        </p>
      </div>

      {/* Stats Entrevistas */}
      <div className="mb-6">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Entrevistas
        </div>
        <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card">
          <StatCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Pendientes (link generado)"
            value={pendingInterviews}
            color="text-muted-foreground"
          />
          <StatCard
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            label="En curso"
            value={inProgressInterviews}
            color="text-photocan-amber"
          />
          <StatCard
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Completadas"
            value={completedInterviews}
            color="text-green-500"
          />
        </div>
      </div>

      {/* Stats Estrategias */}
      <div className="mb-8">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Estrategias
        </div>
        <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card">
          <StatCard
            icon={<FileText className="w-3.5 h-3.5" />}
            label="En revisión interna"
            value={draftStrategies}
            color="text-photocan-amber"
          />
          <StatCard
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Enviadas al cliente"
            value={sentStrategies}
            color="text-blue-500"
          />
          <StatCard
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Aprobadas"
            value={approvedStrategies}
            color="text-green-500"
          />
        </div>
      </div>

      {/* Secciones principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard
          href="/strategy/interviews"
          icon={<MessageSquare className="w-5 h-5" />}
          title="Entrevistas"
          description="Genera links para que el cliente converse con la IA"
          count={interviews.length}
          cta="Gestionar"
        />

        <SectionCard
          href="/strategy/strategies"
          icon={<Sparkles className="w-5 h-5" />}
          title="Estrategias"
          description="Revisa y aprueba las 7 capas generadas por IA"
          count={strategies.length}
          cta="Revisar"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 border-r border-border last:border-r-0">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${color}`}>
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  href,
  icon,
  title,
  description,
  count,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="border border-border rounded-lg bg-card p-5 hover:border-photocan-amber/40 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center text-photocan-amber-deep">
          {icon}
        </div>
        <div className="text-2xl font-semibold font-mono text-muted-foreground">
          {count}
        </div>
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      <div className="text-xs font-mono text-photocan-amber-deep flex items-center gap-1 group-hover:gap-2 transition-all">
        {cta}
        <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}
