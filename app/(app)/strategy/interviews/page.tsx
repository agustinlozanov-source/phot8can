import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { InterviewsList } from './interviews-list';
import { NewInterviewButton } from './new-interview-button';

export default async function InterviewsPage() {
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

  const canCreate = hasPermission(ctx, 'strategy.create_interview');

  const supabase = await createClient();

  const { data: interviews } = await supabase
    .from('interviews')
    .select(
      `
      *,
      client:clients(id, name),
      creator:users!interviews_created_by_fkey(id, first_name, last_name)
    `
    )
    .order('created_at', { ascending: false });

  // Cargar clientes activos para el modal de nueva entrevista
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, legal_name')
    .is('archived_at', null)
    .eq('status', 'active')
    .order('name');

  return (
    <div className="p-8 max-w-7xl">
      <Link
        href="/strategy"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Estrategia
      </Link>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Entrevistas
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Conversaciones con IA
          </h1>
          <p className="text-muted-foreground text-sm">
            {(interviews || []).length} entrevistas en total
          </p>
        </div>

        {canCreate && <NewInterviewButton clients={clients || []} />}
      </div>

      {(interviews || []).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin entrevistas</div>
          <div className="text-sm text-muted-foreground mb-4">
            Crea una entrevista para enviarle el link a tu cliente. Lía
            conversará con él/ella y Claude generará la estrategia
            automáticamente.
          </div>
          {canCreate && <NewInterviewButton clients={clients || []} />}
        </div>
      ) : (
        <InterviewsList interviews={(interviews || []) as never} />
      )}
    </div>
  );
}
