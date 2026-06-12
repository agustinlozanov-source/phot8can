import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { InterviewChat } from './interview-chat';
import type { InterviewTurn } from '@/lib/types/database';

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createServiceClient();

  const { data: interview } = await supabase
    .from('interviews')
    .select(
      'id, status, mode, transcript, system_prompt_snapshot, organization_id, client_id'
    )
    .eq('public_access_token', token)
    .maybeSingle();

  if (!interview) notFound();

  // Solo permitimos modo texto en este bloque (voz será otro bloque)
  if (interview.mode !== 'text') {
    notFound();
  }

  if (interview.status === 'cancelled') {
    return <InterviewClosed reason="cancelled" />;
  }

  if (interview.status === 'completed' || interview.status === 'processing') {
    return <InterviewClosed reason="completed" />;
  }

  if (interview.status === 'failed') {
    return <InterviewClosed reason="failed" />;
  }

  // Cargar info del cliente y prompts
  const [clientResult, promptsResult, orgResult] = await Promise.all([
    supabase
      .from('clients')
      .select('name')
      .eq('id', interview.client_id)
      .maybeSingle(),
    supabase
      .from('strategy_prompts')
      .select('interviewer_name')
      .eq('organization_id', interview.organization_id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('name, primary_color')
      .eq('id', interview.organization_id)
      .maybeSingle(),
  ]);

  const transcript = (interview.transcript as InterviewTurn[]) || [];

  return (
    <InterviewChat
      token={token}
      interviewId={interview.id}
      initialTranscript={transcript}
      clientName={clientResult.data?.name || 'tu negocio'}
      interviewerName={promptsResult.data?.interviewer_name || 'Lía'}
      orgName={orgResult.data?.name || 'la agencia'}
      orgColor={orgResult.data?.primary_color || '#E89A1F'}
      isResuming={transcript.length > 0}
    />
  );
}

// ============================================================
// PANTALLA DE ENTREVISTA CERRADA
// ============================================================

function InterviewClosed({
  reason,
}: {
  reason: 'cancelled' | 'completed' | 'failed';
}) {
  const messages = {
    cancelled: {
      title: 'Entrevista cancelada',
      description:
        'Esta entrevista fue cancelada por la agencia. Si crees que es un error, contáctalos directamente.',
    },
    completed: {
      title: 'Entrevista completada',
      description:
        '¡Listo! Ya recibimos tus respuestas. La agencia está preparando tu estrategia. Te avisarán cuando esté lista.',
    },
    failed: {
      title: 'Hubo un problema',
      description:
        'No pudimos procesar tu entrevista. Por favor contacta a la agencia para que generen un nuevo link.',
    },
  };

  const { title, description } = messages[reason];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-photocan-amber/10 border-2 border-photocan-amber/30 grid place-items-center mx-auto mb-4">
          <div className="text-2xl">
            {reason === 'completed' ? '✓' : reason === 'failed' ? '!' : '×'}
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
