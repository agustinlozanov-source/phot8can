// Helpers presentacionales compartidos del módulo OTs.
// Sin hooks ni APIs de cliente → usables en server y client components.

import {
  Clock,
  Hammer,
  Eye,
  CheckCircle2,
  Send,
  XCircle,
  Circle,
  PlayCircle,
  Ban,
  FileText,
  Film,
  Images,
  Video,
  Radio,
  Square,
  Palette,
  Scissors,
  PenLine,
  Search,
  Camera,
} from 'lucide-react';
import type {
  WorkOrderStatus,
  WorkOrderTaskStatus,
  TaskStageType,
} from '@/lib/types/database';

// ============================================================
// ESTADO DE LA OT
// ============================================================

export const WO_STATUS_META: Record<
  WorkOrderStatus,
  { label: string; Icon: React.ElementType; bg: string }
> = {
  pending: { label: 'Pendiente', Icon: Clock, bg: 'bg-secondary text-muted-foreground' },
  in_production: {
    label: 'En producción',
    Icon: Hammer,
    bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
  },
  review: { label: 'En revisión', Icon: Eye, bg: 'bg-blue-500/10 text-blue-500' },
  ready: {
    label: 'Lista',
    Icon: CheckCircle2,
    bg: 'bg-green-500/10 text-green-500',
  },
  published: { label: 'Publicada', Icon: Send, bg: 'bg-green-600/15 text-green-600' },
  cancelled: {
    label: 'Cancelada',
    Icon: XCircle,
    bg: 'bg-destructive/10 text-destructive',
  },
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const { label, Icon, bg } = WO_STATUS_META[status];
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
// ESTADO DE TAREA
// ============================================================

export const TASK_STATUS_META: Record<
  WorkOrderTaskStatus,
  { label: string; Icon: React.ElementType; bg: string }
> = {
  pending: { label: 'Pendiente', Icon: Circle, bg: 'bg-secondary text-muted-foreground' },
  in_progress: {
    label: 'En curso',
    Icon: PlayCircle,
    bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
  },
  blocked: { label: 'Bloqueada', Icon: Ban, bg: 'bg-destructive/10 text-destructive' },
  done: { label: 'Lista', Icon: CheckCircle2, bg: 'bg-green-500/10 text-green-500' },
  skipped: { label: 'Omitida', Icon: XCircle, bg: 'bg-muted text-muted-foreground' },
};

export function TaskStatusBadge({ status }: { status: WorkOrderTaskStatus }) {
  const { label, Icon, bg } = TASK_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================
// TIPO DE PIEZA
// ============================================================

export const ITEM_TYPE_META: Record<
  string,
  { label: string; Icon: React.ElementType; color: string }
> = {
  post: { label: 'POST', Icon: FileText, color: 'text-blue-400' },
  reel: { label: 'REEL', Icon: Film, color: 'text-purple-400' },
  story: { label: 'STORY', Icon: Circle, color: 'text-pink-400' },
  carousel: { label: 'CARRUSEL', Icon: Images, color: 'text-photocan-amber' },
  video: { label: 'VIDEO', Icon: Video, color: 'text-red-400' },
  live: { label: 'LIVE', Icon: Radio, color: 'text-green-400' },
  other: { label: 'OTRO', Icon: Square, color: 'text-muted-foreground' },
};

export function ItemTypeBadge({ type }: { type: string }) {
  const meta = ITEM_TYPE_META[type] ?? ITEM_TYPE_META.other;
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary ${meta.color}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ============================================================
// TIPO DE ETAPA
// ============================================================

export const STAGE_TYPE_META: Record<
  TaskStageType,
  { label: string; Icon: React.ElementType }
> = {
  design: { label: 'Diseño', Icon: Palette },
  edit: { label: 'Edición', Icon: Scissors },
  copy: { label: 'Copy', Icon: PenLine },
  review: { label: 'Revisión', Icon: Search },
  shoot: { label: 'Foto/Video', Icon: Camera },
  other: { label: 'Otro', Icon: Square },
};

export function StageTypeBadge({ type }: { type: TaskStageType }) {
  const meta = STAGE_TYPE_META[type] ?? STAGE_TYPE_META.other;
  const Icon = meta.Icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ============================================================
// AVATAR DE INICIALES
// ============================================================

export function Avatar({
  firstName,
  lastName,
  size = 'sm',
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: 'sm' | 'xs';
}) {
  const initials =
    `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() ||
    '?';
  const dim = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]';
  return (
    <span
      className={`${dim} rounded-full bg-secondary border border-border grid place-items-center font-mono font-medium flex-shrink-0`}
    >
      {initials}
    </span>
  );
}

export function UserChip({
  user,
}: {
  user: { first_name: string; last_name: string } | null;
}) {
  if (!user) {
    return (
      <span className="text-xs text-muted-foreground italic">Sin asignar</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar firstName={user.first_name} lastName={user.last_name} size="xs" />
      <span className="text-sm">{user.first_name}</span>
    </span>
  );
}

// ============================================================
// FECHAS Y DEADLINE
// ============================================================

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

// Devuelve tono + etiqueta de proximidad de un deadline (fecha YYYY-MM-DD)
export function deadlineInfo(deadline: string): {
  tone: 'muted' | 'amber' | 'red';
  label: string;
  days: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline + 'T00:00:00');
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  let label: string;
  if (days < 0) label = `Vencido (${Math.abs(days)}d)`;
  else if (days === 0) label = 'Hoy';
  else if (days === 1) label = 'Mañana';
  else label = `En ${days} días`;

  const tone: 'muted' | 'amber' | 'red' =
    days <= 0 ? 'red' : days <= 3 ? 'amber' : 'muted';

  return { tone, label, days };
}

export const DEADLINE_TONE_CLASS: Record<'muted' | 'amber' | 'red', string> = {
  muted: 'text-muted-foreground',
  amber: 'text-photocan-amber-deep',
  red: 'text-destructive',
};
