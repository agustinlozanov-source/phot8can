'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  X,
  TrendingDown,
  CreditCard,
  Ban,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  ExternalLink,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  cancelExpenseAction,
  unmarkAsPaidAction,
} from '@/lib/actions/expenses';
import type { Expense } from '@/lib/types/database';
import {
  ExpenseStatusBadge,
  CategoryBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
  dueDateInfo,
  PAYMENT_METHOD_LABEL,
} from '../../finance-ui';
import { RegisterExpensePaymentModal } from './register-expense-payment-modal';

type ExpenseWithRelations = Expense & {
  vendor: {
    id: string;
    name: string;
    legal_name: string | null;
    tax_id: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
  cancelled_by_user: { id: string; first_name: string; last_name: string } | null;
};

interface Props {
  expense: ExpenseWithRelations;
  canManage: boolean;
  canCancel: boolean;
}

export function ExpenseDetail({ expense, canManage, canCancel }: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const isPending = expense.status === 'pending';
  const isPaid = expense.status === 'paid';
  const isCancelled = expense.status === 'cancelled';

  const dd = expense.due_date
    ? dueDateInfo(expense.due_date, expense.status)
    : null;

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
      cancelExpenseAction({ expense_id: expense.id, reason: cancelReason.trim() })
    );
    if (ok) {
      setCancelOpen(false);
      setCancelReason('');
    }
  }

  async function handleUnmark() {
    if (
      !confirm(
        '¿Anular el pago? El gasto volverá a estado pendiente. Para correcciones.'
      )
    )
      return;
    await run('unmark', () => unmarkAsPaidAction(expense.id));
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm font-medium">{expense.folio}</span>
              <ExpenseStatusBadge status={expense.status} />
              <CategoryBadge
                name={expense.category_name_snapshot}
                color={expense.category?.color}
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{expense.concept}</h1>
            <div className="text-sm text-muted-foreground mt-0.5">
              {expense.vendor_name_snapshot} · {formatDate(expense.issue_date)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Total
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {formatCurrency(Number(expense.total), expense.currency)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {expense.currency}
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

      {/* Banners por estado */}
      {isPending && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            dd?.tone === 'red'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-photocan-amber/30 bg-photocan-amber/5'
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${dd?.tone === 'red' ? 'text-destructive' : 'text-photocan-amber'}`}
              />
              <div>
                <div className="text-sm font-medium">Pendiente de pago</div>
                <div className="text-xs text-muted-foreground">
                  {dd ? `${dd.label} · vence ${formatDate(expense.due_date!)}` : 'Sin fecha de vencimiento'}
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
                  Cancelar gasto
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">
                  Pagado{expense.paid_at && ` el ${formatDate(expense.paid_at.slice(0, 10))}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expense.payment_method && PAYMENT_METHOD_LABEL[expense.payment_method]}
                  {expense.paid_amount != null &&
                    ` · ${formatCurrency(Number(expense.paid_amount), expense.currency)}`}
                  {expense.reference && ` · ${expense.reference}`}
                </div>
                {expense.receipt_url && (
                  <a
                    href={expense.receipt_url}
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
                onClick={handleUnmark}
                disabled={!!actionLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                {actionLoading === 'unmark' ? (
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
                {expense.cancelled_at && ` el ${formatDateTime(expense.cancelled_at)}`}
                {expense.cancelled_by_user &&
                  ` por ${expense.cancelled_by_user.first_name} ${expense.cancelled_by_user.last_name}`}
              </div>
              {expense.cancellation_reason && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {expense.cancellation_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="min-w-0 space-y-6">
          <Section title="Detalle" icon={TrendingDown}>
            {expense.description && (
              <p className="text-sm text-foreground/90 mb-4 whitespace-pre-wrap">
                {expense.description}
              </p>
            )}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Subtotal" value={formatCurrency(Number(expense.subtotal), expense.currency)} />
                  <Row label="Impuestos" value={formatCurrency(Number(expense.taxes), expense.currency)} />
                  <Row label="Total" value={formatCurrency(Number(expense.total), expense.currency)} bold />
                </tbody>
              </table>
            </div>
            {expense.reference && (
              <div className="mt-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                  Referencia
                </div>
                <div className="text-sm font-mono">{expense.reference}</div>
              </div>
            )}
          </Section>

          {expense.notes && (
            <Section title="Notas" icon={FileText}>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                {expense.notes}
              </p>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <SidebarCard label="Proveedor">
            {expense.vendor ? (
              <Link href={`/finance/vendors/${expense.vendor.id}`} className="block group">
                <div className="text-sm font-medium group-hover:text-photocan-amber transition-colors flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {expense.vendor_name_snapshot}
                </div>
                {expense.vendor.tax_id && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    RFC: {expense.vendor.tax_id}
                  </div>
                )}
              </Link>
            ) : (
              <div>
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {expense.vendor_name_snapshot}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  Proveedor sin registrar
                </div>
              </div>
            )}
          </SidebarCard>

          <SidebarCard label="Categoría">
            <div className="flex items-center justify-between">
              <CategoryBadge
                name={expense.category_name_snapshot}
                color={expense.category?.color}
              />
              <Link
                href="/finance/categories"
                className="text-muted-foreground hover:text-photocan-amber"
                title="Ver categorías"
              >
                <Tag className="w-3.5 h-3.5" />
              </Link>
            </div>
          </SidebarCard>

          <SidebarCard label="Fechas">
            <Meta label="Emisión" value={formatDate(expense.issue_date)} />
            {expense.due_date && (
              <Meta label="Vencimiento" value={formatDate(expense.due_date)} />
            )}
            {expense.paid_at && (
              <Meta label="Pagado" value={formatDate(expense.paid_at.slice(0, 10))} />
            )}
          </SidebarCard>

          {expense.receipt_url && (
            <SidebarCard label="Comprobante">
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-photocan-amber-deep hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver comprobante
              </a>
            </SidebarCard>
          )}

          <SidebarCard label="Auditoría">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Creado:</span>
              <span className="font-mono">{formatDateTime(expense.created_at)}</span>
            </div>
            {expense.creator && (
              <div className="text-xs text-muted-foreground">
                por {expense.creator.first_name} {expense.creator.last_name}
              </div>
            )}
          </SidebarCard>
        </div>
      </div>

      {/* Modal registrar pago */}
      {payOpen && (
        <RegisterExpensePaymentModal
          expenseId={expense.id}
          folio={expense.folio}
          total={Number(expense.total)}
          currency={expense.currency}
          onClose={() => setPayOpen(false)}
        />
      )}

      {/* Modal cancelar */}
      {cancelOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCancelOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cancelar gasto</h3>
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
                {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar cancelación'}
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

function SidebarCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
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
      <td className={`px-3 py-2 text-right font-mono ${bold ? 'font-semibold' : ''}`}>
        {value}
      </td>
    </tr>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
