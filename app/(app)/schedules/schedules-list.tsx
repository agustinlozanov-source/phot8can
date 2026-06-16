'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Schedule, ScheduleStatus } from '@/lib/types/database';

type ScheduleRow = Schedule & {
  subscription_period: {
    period_number: number;
    start_date: string;
    end_date: string;
    status: string;
    subscription: {
      name: string;
      billing_cycle: string;
      client: { id: string; name: string; legal_name: string | null } | null;
    } | null;
  } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
  item_total: number;
  item_approved: number;
};

type FilterKey = 'all' | 'pending' | 'ready' | 'errors';

export function SchedulesList({ schedules }: { schedules: ScheduleRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    let result = schedules;

    if (filter === 'pending') {
      result = result.filter(
        (s) => s.status === 'pending' || s.status === 'generating'
      );
    } else if (filter === 'ready') {
      result = result.filter((s) => s.status === 'ready');
    } else if (filter === 'errors') {
      result = result.filter(
        (s) => s.status === 'failed' || s.status === 'partial'
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const sub = s.subscription_period?.subscription;
        return (
          sub?.client?.name.toLowerCase().includes(q) ||
          sub?.name.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [schedules, filter, search]);

  const counts = useMemo(() => {
    return {
      all: schedules.length,
      pending: schedules.filter(
        (s) => s.status === 'pending' || s.status === 'generating'
      ).length,
      ready: schedules.filter((s) => s.status === 'ready').length,
      errors: schedules.filter(
        (s) => s.status === 'failed' || s.status === 'partial'
      ).length,
    };
  }, [schedules]);

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o suscripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton
            label="Todos"
            count={counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Pendientes"
            count={counts.pending}
            active={filter === 'pending'}
            onClick={() => setFilter('pending')}
          />
          <FilterButton
            label="Listos"
            count={counts.ready}
            active={filter === 'ready'}
            onClick={() => setFilter('ready')}
          />
          {counts.errors > 0 && (
            <FilterButton
              label="Con errores"
              count={counts.errors}
              active={filter === 'errors'}
              onClick={() => setFilter('errors')}
            />
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Suscripción
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Período
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Piezas
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Generado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((schedule) => {
                const sub = schedule.subscription_period?.subscription;
                const period = schedule.subscription_period;
                return (
                  <tr
                    key={schedule.id}
                    onClick={() => router.push(`/schedules/${schedule.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {sub?.client?.name || '—'}
                      </div>
                      {sub?.client?.legal_name && (
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {sub.client.legal_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{sub?.name || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {period ? (
                        <div>
                          <div className="font-mono text-xs font-medium">
                            P{period.period_number}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatDate(period.start_date)} —{' '}
                            {formatDate(period.end_date)}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={schedule.status} />
                    </td>
                    <td className="px-4 py-3">
                      {schedule.item_total > 0 ? (
                        <div className="font-mono text-xs">
                          <span className="font-medium">
                            {schedule.item_total}
                          </span>{' '}
                          <span className="text-muted-foreground">total</span>
                          {' · '}
                          <span className="text-green-500 font-medium">
                            {schedule.item_approved}
                          </span>{' '}
                          <span className="text-muted-foreground">aprob.</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {schedule.generated_at
                        ? relativeTime(schedule.generated_at)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <div className="text-sm text-muted-foreground">
            {search.trim()
              ? `No hay resultados para "${search}"`
              : 'No hay cronogramas en este filtro'}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-photocan-amber text-black'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {label}
      <span
        className={`font-mono tabular-nums ${
          active ? 'text-black/70' : 'text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
  const config: Record<
    ScheduleStatus,
    { label: string; icon: React.ReactNode; bg: string }
  > = {
    pending: {
      label: 'Pendiente',
      icon: <Clock className="w-3 h-3" />,
      bg: 'bg-secondary text-muted-foreground',
    },
    generating: {
      label: 'Generando...',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    ready: {
      label: 'Listo',
      icon: <CheckCircle2 className="w-3 h-3" />,
      bg: 'bg-green-500/10 text-green-500',
    },
    partial: {
      label: 'Parcial',
      icon: <AlertCircle className="w-3 h-3" />,
      bg: 'bg-yellow-500/10 text-yellow-500',
    },
    failed: {
      label: 'Fallido',
      icon: <XCircle className="w-3 h-3" />,
      bg: 'bg-destructive/10 text-destructive',
    },
  };
  const { label, icon, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${bg}`}
    >
      {icon}
      {label}
    </span>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

function relativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;

  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;

  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
