'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mic,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Ban,
  Trash2,
  RefreshCw,
  User as UserIcon,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  cancelInterviewAction,
  deleteInterviewAction,
  regenerateInterviewTokenAction,
} from '@/lib/actions/interviews';
import type {
  Interview,
  InterviewStatus,
  InterviewMode,
  InterviewTurn,
} from '@/lib/types/database';

type InterviewWithRelations = Interview & {
  client: { id: string; name: string; legal_name: string | null } | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

type StrategyInfo = {
  id: string;
  status: string;
  generated_at: string;
  title: string;
} | null;

interface Props {
  interview: InterviewWithRelations;
  strategy: StrategyInfo;
  canManage: boolean;
}

export function InterviewDetail({
  interview,
  strategy,
  canManage,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcript = (interview.transcript as InterviewTurn[]) || [];
  const isPending = interview.status === 'pending';
  const isInProgress = interview.status === 'in_progress';
  const isCompleted = ['completed', 'processing'].includes(interview.status);
  const isFailed = interview.status === 'failed';
  const isCancelled = interview.status === 'cancelled';

  function getInterviewUrl() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/interview/${interview.public_access_token}`;
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(getInterviewUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar esta entrevista? El link dejará de funcionar.'))
      return;
    setError(null);
    setActionLoading('cancel');
    const result = await cancelInterviewAction(interview.id);
    setActionLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleRegenerateToken() {
    if (
      !confirm(
        '¿Generar un nuevo link? El link anterior dejará de funcionar inmediatamente.'
      )
    )
      return;
    setError(null);
    setActionLoading('regen');
    const result = await regenerateInterviewTokenAction(interview.id);
    setActionLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        '¿Eliminar esta entrevista permanentemente? Se perderá el transcript.'
      )
    )
      return;
    setError(null);
    setActionLoading('delete');
    const result = await deleteInterviewAction(interview.id);
    setActionLoading(null);
    if (result?.error) setError(result.error);
    else router.push('/strategy/interviews');
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={interview.status} />
              <ModeBadge mode={interview.mode} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              Entrevista a {interview.client?.name || 'cliente eliminado'}
            </h1>
            {interview.client?.legal_name && (
              <div className="text-sm text-muted-foreground">
                {interview.client.legal_name}
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {(isPending || isInProgress) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateToken}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'regen' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Nuevo link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={!!actionLoading}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancelar
                  </Button>
                </>
              )}

              {(isCancelled || isFailed) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'delete' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  )}
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Mensaje de error si falló */}
        {isFailed && interview.error_message && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1">
              Error en el procesamiento
            </div>
            <div className="text-foreground/80">{interview.error_message}</div>
          </div>
        )}
      </div>

      {/* Banner del link (si pending o in_progress) */}
      {(isPending || isInProgress) && (
        <div className="mb-6 border border-photocan-amber/30 bg-photocan-amber/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
              <ExternalLink className="w-4 h-4 text-photocan-amber-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">
                Link de la entrevista
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Comparte este link con{' '}
                {interview.contact
                  ? `${interview.contact.first_name} ${interview.contact.last_name}`
                  : 'tu cliente'}
                . Sin login.
              </p>
              <div className="flex items-center gap-2 p-2 bg-background rounded-md border border-border mb-2">
                <code className="text-xs font-mono truncate flex-1">
                  {getInterviewUrl()}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar link
                    </>
                  )}
                </Button>
                <a
                  href={getInterviewUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner si tiene estrategia */}
      {strategy && (
        <div className="mb-6">
          <Link
            href={`/strategy/strategies/${strategy.id}`}
            className="block border border-photocan-amber/40 bg-photocan-amber/10 rounded-lg p-4 hover:bg-photocan-amber/15 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-photocan-amber/20 border border-photocan-amber/40 grid place-items-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-photocan-amber-deep" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-photocan-amber-deep mb-0.5">
                  Estrategia generada
                </div>
                <div className="font-medium truncate">{strategy.title}</div>
                <div className="text-xs text-muted-foreground">
                  Estado: <StrategyStatusLabel status={strategy.status} />
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-photocan-amber-deep group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      )}

      {/* Banner si está procesando */}
      {interview.status === 'processing' && (
        <div className="mb-6 rounded-md bg-blue-500/10 border border-blue-500/30 p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
          <div>
            <div className="text-sm font-medium mb-0.5">
              Generando estrategia...
            </div>
            <div className="text-xs text-muted-foreground">
              Claude está procesando el transcript. Esto puede tomar 30 segundos.
              Refresca la página para ver el resultado.
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Columna izquierda: transcript */}
        <div className="min-w-0">
          <div className="border border-border rounded-lg bg-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                  Conversación
                </div>
                <div className="text-sm font-medium">
                  {transcript.length}{' '}
                  {transcript.length === 1 ? 'turno' : 'turnos'}
                </div>
              </div>
              {isInProgress && (
                <div className="flex items-center gap-1.5 text-xs text-photocan-amber-deep">
                  <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber animate-pulse" />
                  En vivo
                </div>
              )}
            </div>

            {transcript.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground">
                  {isPending
                    ? 'El cliente aún no ha iniciado la entrevista.'
                    : 'Sin conversación registrada.'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {transcript.map((turn, idx) => (
                  <TranscriptTurn key={idx} turn={turn} index={idx} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            <SidebarRow
              icon={<UserIcon className="w-3.5 h-3.5" />}
              label="Cliente"
              value={interview.client?.name || '—'}
            />

            {interview.contact && (
              <SidebarRow
                icon={<UserIcon className="w-3.5 h-3.5" />}
                label="Contacto"
                value={`${interview.contact.first_name} ${interview.contact.last_name}`}
                hint={interview.contact.email}
              />
            )}

            <SidebarRow
              icon={
                interview.mode === 'voice' ? (
                  <Mic className="w-3.5 h-3.5" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5" />
                )
              }
              label="Modo"
              value={interview.mode === 'voice' ? 'Voz' : 'Texto'}
            />

            {interview.started_at && (
              <SidebarRow
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Iniciada"
                value={new Date(interview.started_at).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            )}

            {interview.completed_at && (
              <SidebarRow
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label="Completada"
                value={new Date(interview.completed_at).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                hint={
                  interview.duration_seconds
                    ? `Duración: ${formatDuration(interview.duration_seconds)}`
                    : undefined
                }
              />
            )}

            <SidebarRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Creada"
              value={new Date(interview.created_at).toLocaleDateString(
                'es-MX',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }
              )}
              hint={
                interview.creator
                  ? `Por ${interview.creator.first_name} ${interview.creator.last_name}`
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function TranscriptTurn({
  turn,
  index,
}: {
  turn: InterviewTurn;
  index: number;
}) {
  const isAssistant = turn.role === 'assistant';

  return (
    <div className="p-4 flex items-start gap-3">
      <div
        className={`w-7 h-7 rounded-full grid place-items-center flex-shrink-0 ${
          isAssistant
            ? 'bg-photocan-amber/10 border border-photocan-amber/30 text-photocan-amber-deep'
            : 'bg-blue-500/10 border border-blue-500/30 text-blue-500'
        }`}
      >
        {isAssistant ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <UserIcon className="w-3.5 h-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {isAssistant ? 'Lía' : 'Cliente'} · Turno {index + 1}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {new Date(turn.at).toLocaleString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {turn.content}
        </p>
      </div>
    </div>
  );
}

function SidebarRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground truncate">{hint}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: InterviewStatus }) {
  const config = {
    pending: {
      label: 'Pendiente · esperando cliente',
      Icon: Clock,
      bg: 'bg-secondary text-muted-foreground',
    },
    in_progress: {
      label: 'En curso',
      Icon: MessageSquare,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    completed: {
      label: 'Completada',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    processing: {
      label: 'Procesando estrategia',
      Icon: Loader2,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    failed: {
      label: 'Fallida',
      Icon: AlertCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    cancelled: {
      label: 'Cancelada',
      Icon: XCircle,
      bg: 'bg-muted text-muted-foreground',
    },
  };
  const { label, Icon, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

function ModeBadge({ mode }: { mode: InterviewMode }) {
  if (mode === 'voice') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">
        <Mic className="w-3 h-3" />
        Voz
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
      <MessageSquare className="w-3 h-3" />
      Texto
    </span>
  );
}

function StrategyStatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    review: 'En revisión',
    sent: 'Enviada al cliente',
    viewed: 'Vista por el cliente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    archived: 'Archivada',
  };
  return <span className="text-foreground">{labels[status] || status}</span>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
