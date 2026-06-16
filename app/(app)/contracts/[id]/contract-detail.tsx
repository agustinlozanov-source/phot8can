'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileSignature,
  Eye,
  Clock,
  ExternalLink,
  Ban,
  RefreshCw,
  Calendar,
  Briefcase,
  User as UserIcon,
  Receipt,
  ScrollText,
  Repeat,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  sendContractAction,
  cancelContractAction,
  regenerateContractTokenAction,
} from '@/lib/actions/contracts';
import { createSubscriptionFromContractAction } from '@/lib/actions/subscriptions';
import type {
  Contract,
  ContractStatus,
  ContractSignature,
  ContractBody,
} from '@/lib/types/database';

type ContractWithRelations = Contract & {
  client: { id: string; name: string; legal_name: string | null; tax_id: string | null } | null;
  contact: { id: string; first_name: string; last_name: string; email: string } | null;
  source_quote: { id: string; folio: string; title: string } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  contract: ContractWithRelations;
  signature: ContractSignature | null;
  canManage: boolean;
  canCancel: boolean;
  canManageSubscriptions: boolean;
  existingSubscription: { id: string; status: string } | null;
}

export function ContractDetail({
  contract,
  signature,
  canManage,
  canCancel,
  canManageSubscriptions,
  existingSubscription,
}: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const body = contract.contract_body as unknown as ContractBody;
  const isDraft = contract.status === 'draft';
  const isSent = ['sent', 'viewed'].includes(contract.status);
  const isSigned = contract.status === 'signed';
  const isCancelled = contract.status === 'cancelled';
  const isExpiredStatus = contract.status === 'expired';

  function getPublicUrl() {
    if (!contract.public_access_token) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/contracts/sign/${contract.public_access_token}`;
  }

  async function handleCopyLink() {
    const url = getPublicUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSend() {
    setError(null);
    setActionLoading('send');
    const result = await sendContractAction(contract.id);
    setActionLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleRegenerateToken() {
    if (
      !confirm(
        '¿Generar un nuevo link de firma? El link anterior dejará de funcionar inmediatamente.'
      )
    )
      return;
    setError(null);
    setActionLoading('regen');
    const result = await regenerateContractTokenAction(contract.id);
    setActionLoading(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleCancel() {
    setError(null);

    if (!cancelReason || cancelReason.trim().length < 5) {
      setError('Indica el motivo de cancelación (mín. 5 caracteres)');
      return;
    }

    setActionLoading('cancel');
    const result = await cancelContractAction({
      contract_id: contract.id,
      reason: cancelReason.trim(),
    });
    setActionLoading(null);

    if (result?.error) {
      setError(result.error);
    } else {
      setShowCancelModal(false);
      router.refresh();
    }
  }

  async function handleCreateSubscription() {
    setError(null);
    setActionLoading('subscription');
    const result = await createSubscriptionFromContractAction({
      contract_id: contract.id,
    });
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
    } else if (result?.subscriptionId) {
      router.push(`/subscriptions/${result.subscriptionId}`);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="font-mono text-sm font-medium">
                {contract.folio}
              </div>
              <StatusBadge status={contract.status} />
              <BillingCycleBadge cycle={contract.billing_cycle} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {contract.title}
            </h1>
            {contract.client && (
              <div className="text-sm text-muted-foreground">
                Para{' '}
                <span className="text-foreground font-medium">
                  {contract.client.name}
                </span>
                {contract.client.legal_name && (
                  <span className="text-muted-foreground/70">
                    {' · ' + contract.client.legal_name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDraft && canManage && (
              <Button onClick={handleSend} disabled={!!actionLoading}>
                {actionLoading === 'send' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar al cliente
                  </>
                )}
              </Button>
            )}

            {isSent && canManage && (
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
            )}

            {(isDraft || isSent) && canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCancelModal(true)}
                disabled={!!actionLoading}
              >
                <Ban className="w-3.5 h-3.5" />
                Cancelar
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

        {/* Banner: cancelado */}
        {isCancelled && contract.cancellation_reason && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm mt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1">
              Contrato cancelado
            </div>
            <div>{contract.cancellation_reason}</div>
          </div>
        )}

        {/* Banner: expirado */}
        {isExpiredStatus && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm mt-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Este contrato expiró sin firma</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Si quieres seguir adelante, cancela este y genera uno nuevo
                desde la cotización original.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Banner del link de firma */}
      {isSent && contract.public_access_token && (
        <div className="mb-6 border border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/30 grid place-items-center flex-shrink-0">
              <FileSignature className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">
                Link para firma del cliente
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Comparte este link con{' '}
                {contract.contact
                  ? `${contract.contact.first_name} ${contract.contact.last_name}`
                  : 'tu cliente'}
                . Expira el{' '}
                <strong className="text-foreground">
                  {new Date(contract.expires_at).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                .
              </p>
              <div className="flex items-center gap-2 p-2 bg-background rounded-md border border-border mb-2">
                <code className="text-xs font-mono truncate flex-1">
                  {getPublicUrl()}
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

      {/* Banner: firmado */}
      {isSigned && signature && (
        <div className="mb-6 border border-green-500/30 bg-green-500/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-green-500/10 border border-green-500/30 grid place-items-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">
                Contrato firmado
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>
                  Firmado por{' '}
                  <strong className="text-foreground">
                    {signature.signer_name}
                  </strong>
                  {signature.signer_title && `, ${signature.signer_title}`}
                </div>
                <div>
                  {new Date(signature.signed_at).toLocaleString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {signature.ip_address && (
                  <div className="font-mono text-[10px]">
                    IP: {signature.ip_address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suscripción a partir del contrato firmado */}
      {isSigned && (existingSubscription || canManageSubscriptions) && (
        <div className="mb-6 border border-photocan-amber/30 bg-photocan-amber/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-photocan-amber/10 border border-photocan-amber/30 grid place-items-center flex-shrink-0">
              <Repeat className="w-5 h-5 text-photocan-amber" />
            </div>
            <div className="flex-1 min-w-0">
              {existingSubscription ? (
                <>
                  <div className="text-sm font-medium mb-1">
                    Suscripción activa
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Este contrato ya tiene una suscripción asociada. Gestiona
                    sus períodos y entregables desde el detalle.
                  </p>
                  <Link
                    href={`/subscriptions/${existingSubscription.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-photocan-amber-deep hover:underline"
                  >
                    Ver suscripción
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium mb-1">
                    Convertir en suscripción
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Genera una suscripción a partir de este contrato para
                    gestionar entregables recurrentes por período. Se copiarán
                    los servicios del contrato como entregables base.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCreateSubscription}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'subscription' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Repeat className="w-3.5 h-3.5" />
                        Crear suscripción
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Contenido del contrato */}
        <div className="min-w-0 space-y-6">
          {/* Servicios contratados */}
          <ContractSection title="Servicios contratados" icon={Receipt}>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Servicio
                    </th>
                    <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Cant.
                    </th>
                    <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Precio
                    </th>
                    <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {body.services.map((service, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{service.name}</div>
                        {service.description && (
                          <div className="text-xs text-muted-foreground">
                            {service.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {service.quantity}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(service.unit_price, body.pricing.currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">
                        {formatCurrency(service.total, body.pricing.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-3">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(body.pricing.subtotal, body.pricing.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Impuestos</span>
                  <span className="font-mono">
                    {formatCurrency(body.pricing.taxes, body.pricing.currency)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border font-medium">
                  <span>Total {getBillingCycleLabel(body.billing_cycle)}</span>
                  <span className="font-mono">
                    {formatCurrency(body.pricing.total, body.pricing.currency)}
                  </span>
                </div>
              </div>
            </div>
          </ContractSection>

          <ContractSection title="Declaraciones" icon={ScrollText}>
            <ContractHTML html={body.declarations} />
          </ContractSection>

          <ContractSection title="Objeto del contrato" icon={ScrollText}>
            <ContractHTML html={body.object_clause} />
          </ContractSection>

          <ContractSection title="Vigencia y renovación" icon={ScrollText}>
            <ContractHTML html={body.validity_clause} />
          </ContractSection>

          <ContractSection title="Forma de pago" icon={ScrollText}>
            <ContractHTML html={body.payment_clause} />
          </ContractSection>

          <ContractSection title="Obligaciones del proveedor" icon={ScrollText}>
            <ContractHTML html={body.provider_obligations} />
          </ContractSection>

          <ContractSection title="Obligaciones del cliente" icon={ScrollText}>
            <ContractHTML html={body.client_obligations} />
          </ContractSection>

          <ContractSection title="Propiedad intelectual" icon={ScrollText}>
            <ContractHTML html={body.ip_clause} />
          </ContractSection>

          <ContractSection title="Confidencialidad" icon={ScrollText}>
            <ContractHTML html={body.confidentiality_clause} />
          </ContractSection>

          <ContractSection title="Cancelación y avisos" icon={ScrollText}>
            <ContractHTML html={body.cancellation_clause} />
          </ContractSection>

          <ContractSection title="Jurisdicción" icon={ScrollText}>
            <ContractHTML html={body.jurisdiction_clause} />
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              Ciudad: {body.jurisdiction_city}
            </p>
          </ContractSection>

          <ContractSection title="Firma electrónica" icon={ScrollText}>
            <ContractHTML html={body.electronic_signature_clause} />
          </ContractSection>
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
              value={contract.client?.name || '—'}
              hint={body.client.legal_name ?? undefined}
            />

            {body.client.rfc && (
              <SidebarRow
                icon={<Receipt className="w-3.5 h-3.5" />}
                label="RFC"
                value={body.client.rfc}
              />
            )}

            {body.client.representative_name && (
              <SidebarRow
                icon={<UserIcon className="w-3.5 h-3.5" />}
                label="Representante"
                value={body.client.representative_name}
                hint={body.client.representative_title ?? undefined}
              />
            )}

            <div className="pt-3 border-t border-border">
              <SidebarRow
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="Fecha de inicio"
                value={new Date(body.start_date).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            </div>

            {contract.source_quote && (
              <div className="pt-3 border-t border-border">
                <Link
                  href={`/quotes/${contract.source_quote.id}`}
                  className="block group"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <Receipt className="w-3.5 h-3.5" />
                    Cotización origen
                  </div>
                  <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors">
                    {contract.source_quote.folio}
                  </div>
                </Link>
              </div>
            )}

            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-xs text-muted-foreground mb-1">
                Cronología
              </div>
              <TimelineRow
                icon={<FileSignature className="w-3 h-3" />}
                label="Generado"
                date={contract.created_at}
              />
              {contract.sent_at && (
                <TimelineRow
                  icon={<Send className="w-3 h-3" />}
                  label="Enviado"
                  date={contract.sent_at}
                />
              )}
              {contract.viewed_at && (
                <TimelineRow
                  icon={<Eye className="w-3 h-3" />}
                  label="Visto"
                  date={contract.viewed_at}
                />
              )}
              {contract.signed_at && (
                <TimelineRow
                  icon={<CheckCircle2 className="w-3 h-3 text-green-500" />}
                  label="Firmado"
                  date={contract.signed_at}
                />
              )}
              {contract.cancelled_at && (
                <TimelineRow
                  icon={<XCircle className="w-3 h-3 text-destructive" />}
                  label="Cancelado"
                  date={contract.cancelled_at}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal cancelar */}
      {showCancelModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowCancelModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cancelar contrato</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={!!actionLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                El cliente ya no podrá firmar este contrato. Si necesitas
                generar uno nuevo, hazlo desde la cotización original.
              </p>

              <div className="space-y-2">
                <Label htmlFor="cancel_reason">Motivo de cancelación *</Label>
                <textarea
                  id="cancel_reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={!!actionLoading}
                  rows={3}
                  placeholder="Ej: cliente cambió de opinión, ajustes en la propuesta..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                disabled={!!actionLoading}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleCancel}
                disabled={!!actionLoading}
                className="flex-1"
              >
                {actionLoading === 'cancel' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Confirmar cancelación'
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function ContractSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ScrollText;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-photocan-amber" />
        <h2 className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ContractHTML({ html }: { html: string }) {
  return (
    <div
      className="text-sm prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-p:text-foreground/90"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

function TimelineRow({
  icon,
  label,
  date,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-muted-foreground">{label}:</div>
      <div className="font-mono">
        {new Date(date).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const config: Record<
    ContractStatus,
    { label: string; Icon: typeof FileSignature; bg: string }
  > = {
    draft: {
      label: 'Borrador',
      Icon: FileSignature,
      bg: 'bg-secondary text-muted-foreground',
    },
    sent: {
      label: 'Enviado · esperando firma',
      Icon: Send,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    viewed: {
      label: 'Visto por el cliente',
      Icon: Eye,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    signed: {
      label: 'Firmado',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    cancelled: {
      label: 'Cancelado',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    expired: {
      label: 'Expirado',
      Icon: Clock,
      bg: 'bg-destructive/10 text-destructive',
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

function BillingCycleBadge({ cycle }: { cycle: string }) {
  const labels: Record<string, string> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    annual: 'Anual',
    one_time: 'Pago único',
  };
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      {labels[cycle] || cycle}
    </span>
  );
}

function getBillingCycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: 'mensual',
    quarterly: 'trimestral',
    annual: 'anual',
    one_time: 'único',
  };
  return labels[cycle] || cycle;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
