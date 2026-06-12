'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  Archive,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Sparkles,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Calendar,
  Briefcase,
  Mic,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  sendStrategyToClientAction,
  archiveStrategyAction,
} from '@/lib/actions/strategies';
import { LayerCard } from './layer-card';
import type {
  Strategy,
  StrategyStatus,
  StrategyLayer,
} from '@/lib/types/database';

type StrategyWithRelations = Strategy & {
  client: { id: string; name: string; legal_name: string | null } | null;
  interview: {
    id: string;
    mode: 'voice' | 'text';
    completed_at: string | null;
    duration_seconds: number | null;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

type LayerWithReviewer = StrategyLayer & {
  reviewer: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  strategy: StrategyWithRelations;
  layers: LayerWithReviewer[];
  canReview: boolean;
  canApprove: boolean;
  canRegenerate: boolean;
}

export function StrategyDetail({
  strategy,
  layers,
  canReview,
  canApprove,
  canRegenerate,
}: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const approvedCount = layers.filter((l) => l.status === 'approved').length;
  const totalCount = layers.length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  const canBeSent = ['draft', 'review'].includes(strategy.status);
  const isSentToClient = ['sent', 'viewed', 'approved', 'rejected'].includes(
    strategy.status
  );

  function getPublicUrl() {
    if (!strategy.public_access_token) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/strategy/${strategy.public_access_token}`;
  }

  async function handleCopyLink() {
    const url = getPublicUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendToClient() {
    if (!allApproved) {
      setError('Debes aprobar las 7 capas antes de enviar al cliente');
      return;
    }
    if (
      !confirm(
        '¿Enviar esta estrategia al cliente? Se generará un link público que podrás compartir.'
      )
    )
      return;

    setError(null);
    setActionLoading('send');
    const result = await sendStrategyToClientAction(strategy.id);
    setActionLoading(null);

    if (result && 'error' in result && result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleArchive() {
    if (
      !confirm(
        '¿Archivar esta estrategia? Podrás generarla de nuevo más adelante.'
      )
    )
      return;
    setError(null);
    setActionLoading('archive');
    const result = await archiveStrategyAction(strategy.id);
    setActionLoading(null);
    if (result && 'error' in result && result.error) setError(result.error);
    else router.push('/strategy/strategies');
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={strategy.status} />
              {strategy.version > 1 && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  Versión {strategy.version}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {strategy.title}
            </h1>
            {strategy.client && (
              <div className="text-sm text-muted-foreground">
                Para:{' '}
                <span className="text-foreground font-medium">
                  {strategy.client.name}
                </span>
              </div>
            )}
          </div>

          {/* Acciones del header */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canBeSent && canApprove && (
              <Button
                size="sm"
                onClick={handleSendToClient}
                disabled={!allApproved || !!actionLoading}
              >
                {actionLoading === 'send' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Enviar al cliente
                  </>
                )}
              </Button>
            )}

            {['rejected', 'approved'].includes(strategy.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchive}
                disabled={!!actionLoading}
              >
                {actionLoading === 'archive' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                Archivar
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Si el cliente rechazó */}
        {strategy.status === 'rejected' && strategy.rejection_reason && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1">
              Motivo del rechazo del cliente
            </div>
            <div className="text-sm">{strategy.rejection_reason}</div>
            {strategy.decided_at && (
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(strategy.decided_at).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>
        )}

        {/* Si el cliente aprobó */}
        {strategy.status === 'approved' && strategy.approved_by_name && (
          <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 mt-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">
                Aprobada por {strategy.approved_by_name}
              </div>
              {strategy.decided_at && (
                <div className="text-xs text-muted-foreground">
                  {new Date(strategy.decided_at).toLocaleString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Banner del link público si está enviada */}
      {isSentToClient && strategy.public_access_token && (
        <div className="mb-6 border border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/30 grid place-items-center flex-shrink-0">
              <ExternalLink className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">
                Link compartido con el cliente
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-md border border-border mb-2">
                <code className="text-xs font-mono truncate flex-1">
                  {getPublicUrl()}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
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
                      Copiar
                    </>
                  )}
                </Button>
                <a
                  href={getPublicUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-secondary transition-colors flex-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progreso de revisión */}
      {canBeSent && (
        <div className="mb-6 border border-border rounded-lg bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Progreso de revisión
            </div>
            <div className="text-sm font-medium">
              {approvedCount}/{totalCount} capas aprobadas
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-photocan-amber transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          {!allApproved && (
            <div className="text-xs text-muted-foreground mt-2">
              Aprueba las 7 capas para poder enviar la estrategia al cliente.
            </div>
          )}
          {allApproved && (
            <div className="text-xs text-green-500 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Lista para enviar al cliente
            </div>
          )}
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Capas */}
        <div className="space-y-4 min-w-0">
          {layers.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <div className="text-sm text-muted-foreground">
                Sin capas en esta estrategia.
              </div>
            </div>
          ) : (
            layers.map((layer) => (
              <LayerCard
                key={layer.id}
                layer={layer}
                canEdit={canReview && canBeSent}
                canApprove={canApprove && canBeSent}
                canRegenerate={canRegenerate && canBeSent}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Información
            </div>

            <SidebarRow
              icon={<Briefcase className="w-3.5 h-3.5" />}
              label="Cliente"
              value={strategy.client?.name || '—'}
              hint={strategy.client?.legal_name || undefined}
            />

            {strategy.interview && (
              <Link
                href={`/strategy/interviews/${strategy.interview.id}`}
                className="block group"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  {strategy.interview.mode === 'voice' ? (
                    <Mic className="w-3.5 h-3.5" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                  Entrevista origen
                </div>
                <div className="text-sm font-medium group-hover:text-photocan-amber-deep transition-colors">
                  Ver entrevista
                </div>
                {strategy.interview.duration_seconds && (
                  <div className="text-xs text-muted-foreground">
                    Duración:{' '}
                    {formatDuration(strategy.interview.duration_seconds)}
                  </div>
                )}
              </Link>
            )}

            <SidebarRow
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Modelo IA"
              value={strategy.ai_model_used || '—'}
              hint={
                strategy.generation_tokens_input &&
                strategy.generation_tokens_output
                  ? `${strategy.generation_tokens_input + strategy.generation_tokens_output} tokens`
                  : undefined
              }
            />

            <SidebarRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Generada"
              value={new Date(strategy.generated_at).toLocaleDateString(
                'es-MX',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }
              )}
            />

            {strategy.sent_to_client_at && (
              <SidebarRow
                icon={<Send className="w-3.5 h-3.5" />}
                label="Enviada al cliente"
                value={new Date(strategy.sent_to_client_at).toLocaleDateString(
                  'es-MX',
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }
                )}
              />
            )}

            {strategy.viewed_by_client_at && (
              <SidebarRow
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Vista por cliente"
                value={new Date(
                  strategy.viewed_by_client_at
                ).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function StatusBadge({ status }: { status: StrategyStatus }) {
  const config: Record<
    StrategyStatus,
    { label: string; Icon: React.ElementType; bg: string }
  > = {
    draft: {
      label: 'En revisión interna',
      Icon: FileText,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    review: {
      label: 'En revisión interna',
      Icon: FileText,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    sent: {
      label: 'Enviada al cliente',
      Icon: Send,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    viewed: {
      label: 'Vista por el cliente',
      Icon: Eye,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    approved: {
      label: 'Aprobada',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    rejected: {
      label: 'Rechazada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    archived: {
      label: 'Archivada',
      Icon: Archive,
      bg: 'bg-muted text-muted-foreground',
    },
  };
  const { label, Icon, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
