// Helpers presentacionales del módulo Finanzas (sin hooks → server/client).

import { Clock, CheckCircle2, AlertCircle, XCircle, Tag } from 'lucide-react';
import type {
  InvoiceStatus,
  PaymentMethod,
  ExpenseStatus,
} from '@/lib/types/database';

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; Icon: React.ElementType; bg: string }
> = {
  pending: {
    label: 'Pendiente',
    Icon: Clock,
    bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
  },
  paid: {
    label: 'Pagado',
    Icon: CheckCircle2,
    bg: 'bg-green-500/10 text-green-500',
  },
  overdue: {
    label: 'Vencido',
    Icon: AlertCircle,
    bg: 'bg-destructive/10 text-destructive',
  },
  cancelled: {
    label: 'Cancelado',
    Icon: XCircle,
    bg: 'bg-muted text-muted-foreground',
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, Icon, bg } = INVOICE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================
// GASTOS
// ============================================================

export const EXPENSE_STATUS_META: Record<
  ExpenseStatus,
  { label: string; Icon: React.ElementType; bg: string }
> = {
  pending: {
    label: 'Pendiente',
    Icon: Clock,
    bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
  },
  paid: {
    label: 'Pagado',
    Icon: CheckCircle2,
    bg: 'bg-green-500/10 text-green-500',
  },
  cancelled: {
    label: 'Cancelado',
    Icon: XCircle,
    bg: 'bg-muted text-muted-foreground',
  },
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const { label, Icon, bg } = EXPENSE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Badge de categoría con su color. El icon se pasa como nombre lucide pero
// para evitar un mapa gigante usamos un punto de color + nombre (Tag fallback).
export function CategoryBadge({
  name,
  color,
}: {
  name: string | null;
  color?: string | null;
}) {
  if (!name) {
    return <span className="text-xs text-muted-foreground italic">Sin categoría</span>;
  }
  const c = color || '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded"
      style={{ background: `${c}1a`, color: c }}
    >
      <Tag className="w-3 h-3" />
      {name}
    </span>
  );
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

// Indicador de proximidad de vencimiento según estado
export function dueDateInfo(
  dueDate: string,
  status: InvoiceStatus
): { tone: 'muted' | 'amber' | 'red'; label: string; days: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate + 'T00:00:00');
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (status === 'paid' || status === 'cancelled') {
    return { tone: 'muted', label: formatDate(dueDate), days };
  }

  if (status === 'overdue' || days < 0) {
    const overdueDays = Math.abs(days);
    return {
      tone: 'red',
      label: `Vencido hace ${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`,
      days,
    };
  }

  let label: string;
  if (days === 0) label = 'Vence hoy';
  else if (days === 1) label = 'Vence mañana';
  else label = `Vence en ${days} días`;

  const tone: 'muted' | 'amber' | 'red' = days <= 3 ? 'amber' : 'muted';
  return { tone, label, days };
}

export const TONE_CLASS: Record<'muted' | 'amber' | 'red', string> = {
  muted: 'text-muted-foreground',
  amber: 'text-photocan-amber-deep',
  red: 'text-destructive',
};
