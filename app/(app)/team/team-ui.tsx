// Helpers presentacionales del módulo Equipo (sin hooks → server/client).

export type RoleChip = {
  id: string;
  name: string;
  description?: string | null;
};

export function Avatar({
  firstName,
  lastName,
  url,
  size = 'md',
}: {
  firstName?: string | null;
  lastName?: string | null;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials =
    `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() ||
    '?';
  const dim =
    size === 'lg'
      ? 'w-16 h-16 text-xl'
      : size === 'sm'
        ? 'w-7 h-7 text-[10px]'
        : 'w-9 h-9 text-xs';

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={initials}
        className={`${dim} rounded-full object-cover border border-border flex-shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${dim} rounded-full bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-black flex-shrink-0`}
    >
      {initials}
    </span>
  );
}

export function RoleChips({ roles }: { roles: RoleChip[] }) {
  if (!roles || roles.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Sin rol</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
        >
          {r.name}
        </span>
      ))}
    </div>
  );
}

export function MemberStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${
        active
          ? 'bg-green-500/10 text-green-500'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground'}`}
      />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export function generatePassword(): string {
  const chars =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const symbols = '!@#$%&*';
  let out = '';
  // 10 alfanuméricos + 1 símbolo, sin Math.random sesgado de seguridad real
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  out += symbols[Math.floor(Math.random() * symbols.length)];
  return out;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(date: string): {
  days: number;
  label: string;
  tone: 'muted' | 'amber' | 'red';
} {
  const diff = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  let label: string;
  if (diff < 0) label = 'Expirada';
  else if (diff === 0) label = 'Expira hoy';
  else if (diff === 1) label = 'Expira mañana';
  else label = `Expira en ${diff} días`;
  const tone: 'muted' | 'amber' | 'red' =
    diff <= 0 ? 'red' : diff <= 2 ? 'amber' : 'muted';
  return { days: diff, label, tone };
}

export const TONE_CLASS: Record<'muted' | 'amber' | 'red', string> = {
  muted: 'text-muted-foreground',
  amber: 'text-photocan-amber-deep',
  red: 'text-destructive',
};
