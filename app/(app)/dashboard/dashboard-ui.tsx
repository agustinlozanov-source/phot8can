// Helpers presentacionales del Dashboard (sin hooks → server/client).

import {
  Sparkles,
  Calendar,
  CheckSquare,
  AlertCircle,
  Receipt,
  ClipboardList,
  Repeat,
  CreditCard,
  FileText,
  FileCheck,
  CheckCircle2,
  Send,
  type LucideIcon,
} from 'lucide-react';
import type {
  DashboardTodayItem,
  DashboardWeekItem,
  ActivityItem,
} from '@/lib/actions/dashboard';

// ============================================================
// SALUDO
// ============================================================

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function fullDate(): string {
  const s = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// TIEMPO RELATIVO
// ============================================================

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

// ============================================================
// ICONOS POR TIPO
// ============================================================

const TODAY_ICONS: Record<DashboardTodayItem['type'], LucideIcon> = {
  strategy_review: Sparkles,
  schedule_conversion: Calendar,
  schedule_item_approval: CheckSquare,
  work_order_overdue: AlertCircle,
  invoice_overdue: Receipt,
};

const TODAY_LABELS: Record<DashboardTodayItem['type'], string> = {
  strategy_review: 'Estrategia',
  schedule_conversion: 'Cronograma',
  schedule_item_approval: 'Aprobación',
  work_order_overdue: 'OT vencida',
  invoice_overdue: 'Cobro vencido',
};

export function todayIcon(type: DashboardTodayItem['type']): LucideIcon {
  return TODAY_ICONS[type] ?? AlertCircle;
}
export function todayLabel(type: DashboardTodayItem['type']): string {
  return TODAY_LABELS[type] ?? '';
}

const WEEK_ICONS: Record<DashboardWeekItem['type'], LucideIcon> = {
  work_order_due_soon: ClipboardList,
  subscription_renew: Repeat,
  invoice_due: Receipt,
  expense_due: CreditCard,
  contract_expiring: FileText,
};
export function weekIcon(type: DashboardWeekItem['type']): LucideIcon {
  return WEEK_ICONS[type] ?? Calendar;
}

const ACTIVITY_META: Record<
  ActivityItem['type'],
  { Icon: LucideIcon; color: string }
> = {
  quote_created: { Icon: FileText, color: 'text-muted-foreground' },
  contract_signed: { Icon: FileCheck, color: 'text-green-500' },
  invoice_paid: { Icon: CheckCircle2, color: 'text-green-500' },
  work_order_published: { Icon: Send, color: 'text-photocan-amber' },
};
export function activityMeta(type: ActivityItem['type']) {
  return ACTIVITY_META[type] ?? { Icon: FileText, color: 'text-muted-foreground' };
}

// ============================================================
// BADGES
// ============================================================

export const URGENCY_BORDER: Record<DashboardTodayItem['urgency'], string> = {
  critical: 'border-l-destructive',
  high: 'border-l-photocan-amber',
  medium: 'border-l-muted-foreground',
};

export function UrgencyBadge({
  urgency,
}: {
  urgency: DashboardTodayItem['urgency'];
}) {
  const cfg = {
    critical: { label: 'Crítico', cls: 'bg-destructive/10 text-destructive' },
    high: { label: 'Alta', cls: 'bg-photocan-amber/10 text-photocan-amber-deep' },
    medium: { label: 'Media', cls: 'bg-secondary text-muted-foreground' },
  }[urgency];
  return (
    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function DaysBadge({ days }: { days: number }) {
  let label: string;
  if (days <= 0) label = 'Hoy';
  else if (days === 1) label = 'Mañana';
  else label = `En ${days} días`;

  const cls =
    days <= 1
      ? 'bg-destructive/10 text-destructive'
      : days <= 3
        ? 'bg-photocan-amber/10 text-photocan-amber-deep'
        : 'bg-secondary text-muted-foreground';

  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export function formatMoney(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
