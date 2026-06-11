import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { FileText, Send, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { QuotesList } from './quotes-list';
import { NewQuoteButton } from './new-quote-button';

export default async function QuotesPage() {
  const ctx = await getActiveContext();

  if (ctx.mode === 'none' || ctx.mode === 'admin') {
    redirect('/login');
  }

  if (!ctx.organization) redirect('/login');

  if (!hasPermission(ctx, 'quote.view')) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="font-medium mb-1">Sin acceso</div>
          <div className="text-sm text-muted-foreground">
            No tienes permiso para ver cotizaciones.
          </div>
        </div>
      </div>
    );
  }

  const canCreate = hasPermission(ctx, 'quote.create');

  const supabase = await createClient();

  // Cargar cotizaciones con info del cliente
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('*, client:clients(id, name, legal_name)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6">
          <div className="font-medium text-destructive mb-1">
            Error al cargar cotizaciones
          </div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
        </div>
      </div>
    );
  }

  const all = quotes || [];

  // Stats por estado
  const draftCount = all.filter((q) => q.status === 'draft').length;
  const sentCount = all.filter((q) =>
    ['sent', 'viewed'].includes(q.status)
  ).length;
  const approvedCount = all.filter((q) => q.status === 'approved').length;
  const rejectedCount = all.filter((q) => q.status === 'rejected').length;

  // Pipeline (monto pendiente de aprobación)
  const pipelineValue = all
    .filter((q) => ['sent', 'viewed'].includes(q.status))
    .reduce((sum, q) => sum + Number(q.total), 0);

  // Cargar clientes activos para el modal de "Nueva cotización"
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, legal_name')
    .is('archived_at', null)
    .eq('status', 'active')
    .order('name');

  // Cargar plantillas activas
  const { data: templates } = await supabase
    .from('quote_templates')
    .select('id, name, is_default')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('name');

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Comercial
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Cotizaciones
          </h1>
          <p className="text-muted-foreground text-sm">
            Propuestas enviadas a tus clientes. {all.length} en total.
          </p>
        </div>

        {canCreate && (
          <NewQuoteButton
            clients={clients || []}
            templates={templates || []}
          />
        )}
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-border rounded-lg overflow-hidden bg-card mb-6">
        <StatCard
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Borradores"
          value={draftCount}
          color="text-muted-foreground"
        />
        <StatCard
          icon={<Send className="w-3.5 h-3.5" />}
          label="Enviadas"
          value={sentCount}
          color="text-photocan-amber"
        />
        <StatCard
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="Aprobadas"
          value={approvedCount}
          color="text-green-500"
        />
        <StatCard
          icon={<XCircle className="w-3.5 h-3.5" />}
          label="Rechazadas"
          value={rejectedCount}
          color="text-destructive"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="En pipeline"
          value={formatPrice(pipelineValue, 'MXN')}
          color="text-foreground"
          isCurrency
        />
      </div>

      {/* Lista */}
      {all.length > 0 ? (
        <QuotesList quotes={all as any} />
      ) : (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin cotizaciones</div>
          <div className="text-sm text-muted-foreground mb-4">
            Crea tu primera cotización para empezar a generar pipeline
            comercial.
          </div>
          {canCreate && (
            <NewQuoteButton
              clients={clients || []}
              templates={templates || []}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  isCurrency = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="p-4 border-r border-border last:border-r-0">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <div
        className={`font-semibold tracking-tight ${color} ${
          isCurrency ? 'text-base' : 'text-2xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
