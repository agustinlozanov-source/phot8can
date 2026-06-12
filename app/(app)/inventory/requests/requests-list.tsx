'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { AssetRequest, AssetRequestStatus } from '@/lib/types/database';

type RequestWithRelations = AssetRequest & {
  requester: { id: string; first_name: string; last_name: string } | null;
  decider: { id: string; first_name: string; last_name: string } | null;
  client: { id: string; name: string } | null;
};

type FilterStatus = 'all' | AssetRequestStatus;

interface Props {
  requests: RequestWithRelations[];
  itemsByRequest: Record<string, { total: number; returned: number }>;
  initialFilter?: string;
}

export function RequestsList({
  requests,
  itemsByRequest,
  initialFilter,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>(
    (initialFilter as FilterStatus) || 'all'
  );

  // Sync con URL si cambia el query param
  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter as FilterStatus);
    }
  }, [initialFilter]);

  const filtered = useMemo(() => {
    let result = requests;

    if (filter !== 'all') {
      result = result.filter((r) => r.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.purpose.toLowerCase().includes(q) ||
          r.requester?.first_name.toLowerCase().includes(q) ||
          r.requester?.last_name.toLowerCase().includes(q) ||
          r.client?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [requests, filter, search]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      active: requests.filter((r) => r.status === 'active').length,
      returned: requests.filter((r) => r.status === 'returned').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    };
  }, [requests]);

  return (
    <div>
      {/* Búsqueda */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por propósito, solicitante o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto mb-4">
        <FilterButton
          label="Todas"
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
          label="Aprobadas"
          count={counts.approved}
          active={filter === 'approved'}
          onClick={() => setFilter('approved')}
        />
        <FilterButton
          label="Activas"
          count={counts.active}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <FilterButton
          label="Devueltas"
          count={counts.returned}
          active={filter === 'returned'}
          onClick={() => setFilter('returned')}
        />
        {counts.rejected > 0 && (
          <FilterButton
            label="Rechazadas"
            count={counts.rejected}
            active={filter === 'rejected'}
            onClick={() => setFilter('rejected')}
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

      {/* Tabla */}
      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Propósito
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Solicitante
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Fechas
                </th>
                <th className="text-center px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Items
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const items = itemsByRequest[req.id] || {
                  total: 0,
                  returned: 0,
                };
                const isOverdue = isRequestOverdue(req);

                return (
                  <tr
                    key={req.id}
                    onClick={() =>
                      router.push(`/inventory/requests/${req.id}`)
                    }
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium line-clamp-1">
                        {req.purpose}
                      </div>
                      {req.client && (
                        <div className="text-xs text-muted-foreground">
                          Para: {req.client.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {req.requester
                          ? `${req.requester.first_name} ${req.requester.last_name}`
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono">
                        {formatDateRange(req.start_date, req.end_date)}
                      </div>
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>Vencida</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm">
                        {req.status === 'active' && items.returned > 0
                          ? `${items.returned}/${items.total}`
                          : items.total}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
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
              : 'No hay solicitudes en este filtro'}
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

function StatusBadge({ status }: { status: AssetRequestStatus }) {
  const config = {
    pending: {
      label: 'Pendiente',
      Icon: Clock,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    approved: {
      label: 'Aprobada',
      Icon: CheckCircle2,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    active: {
      label: 'Activa',
      Icon: Send,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    returned: {
      label: 'Devuelta',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    rejected: {
      label: 'Rechazada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    cancelled: {
      label: 'Cancelada',
      Icon: XCircle,
      bg: 'bg-muted text-muted-foreground',
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

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (start === end) {
    return startDate.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return `${startDate.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })} → ${endDate.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

function isRequestOverdue(req: AssetRequest): boolean {
  if (req.status !== 'active') return false;
  const endDate = new Date(req.end_date);
  return endDate < new Date();
}
