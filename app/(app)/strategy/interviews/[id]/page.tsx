import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveContext, hasPermission } from '@/lib/auth/context';
import { InterviewDetail } from './interview-detail';

export default async function InterviewDetailPage({
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

  const { data: interview } = await supabase
    .from('interviews')
    .select(
      `
      *,
      client:clients(id, name, legal_name),
      contact:contacts(id, first_name, last_name, email),
      creator:users!interviews_created_by_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!interview) notFound();

  // Cargar estrategia asociada si existe
  const { data: strategy } = await supabase
    .from('strategies')
    .select('id, status, generated_at, title')
    .eq('interview_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const canManage = hasPermission(ctx, 'strategy.create_interview');

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/strategy/interviews"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        Entrevistas
      </Link>

      <InterviewDetail
        interview={interview as never}
        strategy={strategy}
        canManage={canManage}
      />
    </div>
  );
}
