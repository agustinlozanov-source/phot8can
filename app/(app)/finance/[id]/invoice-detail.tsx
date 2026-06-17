'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  X,
  Receipt,
  CreditCard,
  Ban,
  Calendar,
  Building2,
  Repeat,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  cancelInvoiceAction,
  deletePaymentAction,
} from '@/lib/actions/invoices';
import type { Invoice } from '@/lib/types/database';
import {
  InvoiceStatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
  dueDateInfo,
  PAYMENT_METHOD_LABEL,
} from '../finance-ui';
import { RegisterPaymentModal } from './register-payment-modal';

type PaymentInfo = {
  id: string;
  amount: number;
  payment_method: keyof typeof PAYMENT_METHOD_LABEL;
  payment_date: string;
  reference: string | null;
  receipt_url: string | null;
  notes: string | null;
};

type InvoiceWithRelations = Invoice & {
  client: {
    id: string;
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    address: unknown;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
  payment: PaymentInfo | PaymentInfo[] | null;
  source_period: {
    id: string;
    period_number: number;
    start_date: string;
    end_date: string;
    subscription: { id: string; name: string } | null;
  } | null;
};

interface Props {
  invoice: InvoiceWithRelations;
  canManage: boolean;
  canCancel: boolean;
}

export function InvoiceDetail({ invoice, canManage, canCancel }: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const payment = Array.isArray(invoice.payment)
    ? invoice.payment[0] ?? null
    : invoice.payment;

  const isPending = invoice.status === 'pending';
  const isOverdue = invoice.status === 'overdue';
  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';

  const dd = dueDateInfo(invoice.due_date, invoice.status);

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setError(null);
    setActionLoading(key);
    const result = await fn();
    setActionLoading(null);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleCancel() {
    if (cancelReason.trim().length < 5) {
      setError('Indica el motivo (mín. 5 caracteres)');
      return;
    }
    const ok = await run('cancel', () =>
      cancelInvoiceAction({
        invoice_id: invoice.id,
        reason: cancelReason.trim(),
      })
    );
    if (ok) {
      setCancelOpen(false);
      setCancelReason('');
    }
  }

  async function handleDeletePayment() {
    if (!payment) return;
    if (
      !confirm(
        '¿Anular el pago registrado? La factura volverá a estado pendiente. Esta acción es para correcciones.'
      )
    )
      return;
    await run('delpay', () => deletePaymentAction(payment.id));
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm font-medium">
                {invoice.folio}
              </span>
              <InvoiceStatusBadge status={invoice.status} />
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground inline-flex items-center gap-1">
                {invoice.source === 'subscription_period' ? (
                  <>
                    <Repeat className="w-3 h-3" /> Suscripción
                  </>
                ) : (
                  <>
                    <Receipt className="w-3 h-3" /> Manual
                  </>
                )}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.title}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Total
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {formatCurrency(Number(invoice.total), invoice.currency)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {invoice.currency}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Banner según estado */}
      {(isPending || isOverdue) && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            isOverdue
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-photocan-amber/30 bg-photocan-amber/5'
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isOverdue ? 'text-destructive' : 'text-photocan-amber'}`}
              />
              <div>
                <div className="text-sm font-medium">
                  {isOverdue ? 'Cobro vencido' : 'Cobro pendiente'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dd.label} · vence {formatDate(invoice.due_date)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button size="sm" onClick={() => setPayOpen(true)} disabled={!!actionLoading}>
                  <CreditCard className="w-3.5 h-3.5" />
                  Registrar pago
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setCancelReason('');
                    setCancelOpen(true);
                  }}
                  disabled={!!actionLoading}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancelar cobro
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {isPaid && payment && (
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  Pagado el {formatDate(payment.payment_date)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[payment.payment_method]}
                  {payment.reference && ` · ${payment.reference}`}
                </div>
                {payment.receipt_url && (
                  <a
                    href={payment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-photocan-amber-deep hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver comprobante
                  </a>
                )}
              </div>
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeletePayment}
                disabled={!!actionLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                {actionLoading === 'delpay' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Anular pago
              </Button>
            )}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">
                Cancelado
                {invoice.cancelled_at && ` el ${formatDateTime(invoice.cancelled_at)}`}
              </div>
              {invoice.cancellation_reason && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {invoice.cancellation_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="min-w-0 space-y-6">
          <Section title="Detalle del cobro" icon={Receipt}>
            {invoice.description && (
              <p className="text-sm text-foreground/90 mb-4 whitespace-pre-wrap">
                {invoice.description}
              </p>
            )}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Subtotal" value={formatCurrency(Number(invoice.subtotal), invoice.currency)} />
                  <Row label="Impuestos" value={formatCurrency(Number(invoice.taxes), invoice.currency)} />
                  <Row
                    label="Total"
                    value={formatCurrency(Number(invoice.total), invoice.currency)}
                    bold
                  />
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Meta label="Fecha de emisión" value={formatDate(invoice.issue_date)} />
              <Meta label="Fecha de vencimiento" value={formatDate(invoice.due_date)} />
            </div>
          </Section>

          {invoice.notes && (
            <Section title="Notas" icon={FileText}>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Cliente
            </div>
            {invoice.client && (
              <Link href={`/clients/${invoice.client.id}`} className="block group">
                <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {invoice.client.name}
                </div>
                {invoice.client.legal_name && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {invoice.client.legal_name}
                  </div>
                )}
                {invoice.client.tax_id && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    RFC: {invoice.client.tax_id}
                  </div>
                )}
              </Link>
            )}
          </div>

          <div className="border border-border rounded-lg bg-card p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Origen
            </div>
            {invoice.source === 'subscription_period' && invoice.source_period ? (
              <div>
                <div className="text-sm">
                  Período {invoice.source_period.period_number}
                  {invoice.source_period.subscription && (
                    <> de {invoice.source_period.subscription.name}</>
                  )}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mb-1">
                  {formatDate(invoice.source_period.start_date)} —{' '}
                  {formatDate(invoice.source_period.end_date)}
                </div>
                {invoice.source_period.subscription && (
                  <Link
                    href={`/subscriptions/${invoice.source_period.subscription.id}`}
                    className="inline-flex items-center gap-1 text-xs font-mono text-photocan-amber-deep hover:underline"
                  >
                    <Repeat className="w-3 h-3" />
                    Ver suscripción
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-sm">
                Cobro manual
                {invoice.creator && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {invoice.creator.first_name} {invoice.creator.last_name}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg bg-card p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Cronología
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Creado:</span>
              <span className="font-mono">{formatDateTime(invoice.created_at)}</span>
            </div>
            {payment && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-muted-foreground">Pagado:</span>
                <span className="font-mono">{formatDate(payment.payment_date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal registrar pago */}
      {payOpen && (
        <RegisterPaymentModal
          invoiceId={invoice.id}
          folio={invoice.folio}
          total={Number(invoice.total)}
          currency={invoice.currency}
          onClose={() => setPayOpen(false)}
        />
      )}

      {/* Modal cancelar */}
      {cancelOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCancelOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cancelar cobro</h3>
              <button onClick={() => setCancelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2">
              <Label htmlFor="cancel_reason">Motivo de cancelación *</Label>
              <textarea
                id="cancel_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={actionLoading === 'cancel'}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber resize-none"
              />
            </div>
            <div className="p-5 border-t border-border flex gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={actionLoading === 'cancel'} className="flex-1">
                Volver
              </Button>
              <Button onClick={handleCancel} disabled={actionLoading === 'cancel'} className="flex-1">
                {actionLoading === 'cancel' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
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

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={`px-3 py-2 ${bold ? 'font-medium' : 'text-muted-foreground'}`}>
        {label}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono ${bold ? 'font-semibold' : ''}`}
      >
        {value}
      </td>
    </tr>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
