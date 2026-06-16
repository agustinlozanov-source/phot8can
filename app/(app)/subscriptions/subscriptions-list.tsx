'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  PlayCircle,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type {
  ClientSubscription,
  SubscriptionStatus,
} from '@/lib/types/database';

type SubscriptionWithRelations = ClientSubscription & {
  client: { id: string; name: string } | null;
  source_contract: { id: string; folio: string } | null;
};

type FilterStatus = 'all' | SubscriptionStatus;

interface Props {
  subscriptions: SubscriptionWithRelations[];
}

export function SubscriptionsList({ subscriptions }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = subscriptions;

    if (filter !== 'all') {
      result = result.filter((s) => s.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.client?.name.toLowerCase().includes(q) ||
          s.source_contract?.folio.toLowerCase().includes(q)
      );
    }

    return result;
  }, [subscriptions, filter, search]);

  const counts = useMemo(() => {
    return {
      all: subscriptions.length,
      pending_start: subscriptions.filter((s) => s.status === 'pending_start')
        .length,
      active: subscriptions.filter((s) => s.status === 'active').length,
      paused: subscriptions.filter((s) => s.status === 'paused').length,
      cancelled: subscriptions.filter((s) => s.status === 'cancelled').length,
    };
  }, [subscriptions]);

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cliente o folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto mb-4">
        <FilterButton
          label="Todas"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterButton
          label="Por iniciar"
          count={counts.pending_start}
          active={filter === 'pending_start'}
          onClick={() => setFilter('pending_start')}
        />
        <FilterButton
          label="Activas"
          count={counts.active}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        {counts.paused > 0 && (
          <FilterButton
            label="Pausadas"
            count={counts.paused}
            active={filter === 'paused'}
            onClick={() => setFilter('paused')}
          />
        )}
        {counts.cancelled > 0 && (
          <FilterButton
            label="Canceladas"
            count={counts.cancelled}
            active={filter === 'cancelled'}
            onClick={() => setFilter('cancelled')}
          />
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Suscripción
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ciclo
                </th>
                <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Precio
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Próx. renovación
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => router.push(`/subscriptions/${sub.id}`)}
                  className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium line-clamp-1">{sub.name}</div>
                    {sub.source_contract && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {sub.source_contract.folio}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{sub.client?.name || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {getBillingCycleLabel(sub.billing_cycle)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(sub.price_per_period, sub.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {sub.next_renewal_date
                      ? new Date(sub.next_renewal_date).toLocaleDateString(
                          'es-MX',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        )
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <div className="text-sm text-muted-foreground">
            {search.trim()
              ? `No hay resultados para "${search}"`
              : 'No hay suscripciones en este filtro'}
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
        className={`font-mono text-[10px] ${
          active ? 'text-black/70' : 'text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<
    SubscriptionStatus,
    { label: string; Icon: typeof Clock; bg: string }
  > = {
    pending_start: {
      label: 'Por iniciar',
      Icon: Clock,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    active: {
      label: 'Activa',
      Icon: PlayCircle,
      bg: 'bg-green-500/10 text-green-500',
    },
    paused: {
      label: 'Pausada',
      Icon: PauseCircle,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    cancelled: {
      label: 'Cancelada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
  };
  const { label, Icon, bg } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function getBillingCycleLabel(cycle: string): string {
  const labels: Record<string, string> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    annual: 'Anual',
    one_time: 'Único',
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
