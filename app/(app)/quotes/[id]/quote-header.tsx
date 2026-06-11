'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Copy,
  Trash2,
  MoreVertical,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Link2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  sendQuoteAction,
  approveQuoteAction,
  rejectQuoteAction,
  revertToDraftAction,
  duplicateQuoteAction,
  deleteQuoteAction,
} from '@/lib/actions/quotes';
import type { Quote, QuoteStatus } from '@/lib/types/database';

interface QuoteWithRelations extends Quote {
  client: {
    id: string;
    name: string;
    legal_name: string | null;
  } | null;
  template: {
    id: string;
    name: string;
  } | null;
}

interface Props {
  quote: QuoteWithRelations;
  canEdit: boolean;
  canSend: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
  contacts: Array<{ id: string; first_name: string; last_name: string }>;
  itemsCount: number;
}

export function QuoteHeader({
  quote,
  canEdit,
  canSend,
  canDelete,
  isSuperAdmin,
  itemsCount,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const expired = isExpired(quote.valid_until, quote.status);
  const isDraft = quote.status === 'draft';
  const isSent = quote.status === 'sent';
  const isViewed = quote.status === 'viewed';
  const isDecided = ['approved', 'rejected'].includes(quote.status);

  async function handleSend() {
    if (itemsCount === 0) {
      setError('Agrega al menos un servicio antes de enviar la cotización.');
      return;
    }
    setError(null);
    setActionLoading('send');
    const result = await sendQuoteAction(quote.id);
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleApprove() {
    if (
      !confirm(
        '¿Marcar esta cotización como aprobada? Esto debería reflejar la aprobación real del cliente.'
      )
    )
      return;
    setError(null);
    setActionLoading('approve');
    const result = await approveQuoteAction(quote.id);
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleReject() {
    setError(null);
    setActionLoading('reject');
    const result = await rejectQuoteAction(quote.id, rejectReason || undefined);
    setActionLoading(null);
    setShowRejectModal(false);
    setRejectReason('');
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleRevert() {
    if (
      !confirm(
        'Volver a borrador permite editar la cotización. ¿Continuar?'
      )
    )
      return;
    setError(null);
    setActionLoading('revert');
    const result = await revertToDraftAction(quote.id);
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleDuplicate() {
    setError(null);
    setActionLoading('duplicate');
    const result = await duplicateQuoteAction(quote.id);
    setActionLoading(null);
    setMenuOpen(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.quoteId) {
      router.push(`/quotes/${result.quoteId}`);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        '¿Eliminar esta cotización? Esta acción no se puede deshacer.'
      )
    )
      return;
    setError(null);
    setActionLoading('delete');
    const result = await deleteQuoteAction(quote.id);
    setActionLoading(null);
    setMenuOpen(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push('/quotes');
    }
  }

  async function copyShareLink() {
    if (!quote.public_share_token) return;
    const url = `${window.location.origin}/q/${quote.public_share_token}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <>
      <div className="mb-6">
        {/* Folio + estado + acciones */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="font-mono text-sm font-medium">
                {quote.folio}
              </div>
              <StatusBadge status={quote.status} expired={expired} />
              {quote.template && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  · {quote.template.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {quote.title || 'Cotización sin título'}
            </h1>
            {quote.client && (
              <div className="text-sm text-muted-foreground">
                Para{' '}
                <span className="text-foreground font-medium">
                  {quote.client.name}
                </span>
                {quote.client.legal_name && (
                  <span className="text-muted-foreground/70">
                    {' '}
                    · {quote.client.legal_name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Acciones principales según estado */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Link público (sent o posterior) */}
            {quote.public_share_token && !isDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareLink}
                disabled={!!actionLoading}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    Copiar link
                  </>
                )}
              </Button>
            )}

            {/* Acciones según estado */}
            {isDraft && canSend && (
              <Button
                onClick={handleSend}
                disabled={actionLoading === 'send' || itemsCount === 0}
              >
                {actionLoading === 'send' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar cotización
                  </>
                )}
              </Button>
            )}

            {(isSent || isViewed) && canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApprove}
                  disabled={!!actionLoading}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Marcar aprobada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRejectModal(true)}
                  disabled={!!actionLoading}
                >
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                  Rechazar
                </Button>
              </>
            )}

            {/* Menú con más acciones */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg min-w-[200px] py-1">
                    {canEdit && (
                      <button
                        onClick={handleDuplicate}
                        disabled={!!actionLoading}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        Duplicar
                      </button>
                    )}

                    {isSent && canEdit && (
                      <button
                        onClick={handleRevert}
                        disabled={!!actionLoading}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        Volver a borrador
                      </button>
                    )}

                    {(isDraft && canDelete) ||
                    (isSuperAdmin && !isDraft) ? (
                      <>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={handleDelete}
                          disabled={!!actionLoading}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Aviso de vencida */}
        {expired && !isDecided && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Esta cotización venció el{' '}
              <strong>
                {new Date(quote.valid_until).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
              .
            </span>
          </div>
        )}

        {/* Error inline */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Razón de rechazo */}
        {quote.status === 'rejected' && quote.rejection_reason && (
          <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-sm mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Motivo del rechazo
            </div>
            <div className="text-foreground">{quote.rejection_reason}</div>
          </div>
        )}
      </div>

      {/* Modal de rechazo */}
      {showRejectModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowRejectModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Rechazar cotización</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                El cliente decidió no avanzar con esta propuesta. Registrar el
                motivo te ayuda a aprender del proceso comercial.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Motivo (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Ej: precio fuera de presupuesto, eligió otra agencia..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleReject}
                disabled={actionLoading === 'reject'}
                className="flex-1"
              >
                {actionLoading === 'reject' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Rechazar cotización'
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function StatusBadge({
  status,
  expired,
}: {
  status: QuoteStatus;
  expired: boolean;
}) {
  if (expired && ['sent', 'viewed'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        Vencida
      </span>
    );
  }

  const config = {
    draft: { label: 'Borrador', color: 'text-muted-foreground', bg: 'bg-secondary' },
    sent: {
      label: 'Enviada',
      color: 'text-photocan-amber-deep',
      bg: 'bg-photocan-amber/10',
    },
    viewed: { label: 'Vista', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    approved: { label: 'Aprobada', color: 'text-green-500', bg: 'bg-green-500/10' },
    rejected: { label: 'Rechazada', color: 'text-destructive', bg: 'bg-destructive/10' },
    expired: { label: 'Vencida', color: 'text-destructive', bg: 'bg-destructive/10' },
  };
  const { label, color, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${color} ${bg}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function isExpired(validUntil: string, status: QuoteStatus): boolean {
  if (status === 'approved' || status === 'rejected') return false;
  return new Date(validUntil) < new Date();
}
