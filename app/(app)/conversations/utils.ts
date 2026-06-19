import type { ConversationWithRelations } from '@/lib/types/database';

// Nombre a mostrar: cliente asociado → display name remoto → teléfono → fallback
export function conversationName(c: {
  client?: { name: string } | null;
  remote_display_name?: string | null;
  remote_phone?: string | null;
}): string {
  return (
    c.client?.name ||
    c.remote_display_name ||
    c.remote_phone ||
    'Desconocido'
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Color de avatar determinístico según el nombre
const AVATAR_COLORS = [
  'bg-rose-500/20 text-rose-300',
  'bg-orange-500/20 text-orange-300',
  'bg-amber-500/20 text-amber-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-teal-500/20 text-teal-300',
  'bg-sky-500/20 text-sky-300',
  'bg-indigo-500/20 text-indigo-300',
  'bg-fuchsia-500/20 text-fuchsia-300',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// "hace 5 min", "ayer", "12 jun"
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24 && now.getDate() === date.getDate()) {
    return `hace ${diffH} h`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'ayer';
  }

  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// "14:30"
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Separador de día: "Hoy", "Ayer", "12 de junio de 2026"
export function formatDaySeparator(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (isSameDay(date, now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Ayer';

  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

// Etiqueta corta de plataforma
export function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    whatsapp: 'WA',
    instagram: 'IG',
    facebook: 'FB',
    telegram: 'TG',
    sms: 'SMS',
  };
  return map[platform] ?? platform.toUpperCase();
}

// ¿La conversación de WhatsApp está fuera de la ventana de 24h?
export function isOutside24hWindow(
  c: Pick<ConversationWithRelations, 'platform' | 'last_inbound_at'>
): boolean {
  if (c.platform !== 'whatsapp') return false;
  if (!c.last_inbound_at) return true;
  const windowMs = 24 * 60 * 60 * 1000;
  return Date.now() - new Date(c.last_inbound_at).getTime() > windowMs;
}
