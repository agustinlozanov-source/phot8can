'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { WorkOrder, WorkOrderStatus } from '@/lib/types/database';
import {
  WorkOrderStatusBadge,
  ItemTypeBadge,
  UserChip,
  deadlineInfo,
  DEADLINE_TONE_CLASS,
} from './wo-ui';

type WorkOrderRow = WorkOrder & {
  client: { id: string; name: string } | null;
  source_schedule_item: {
    id: string;
    title: string;
    item_type: string;
    pillar_name: string | null;
  } | null;
  owner: { id: string; first_name: string; last_name: string } | null;
  task_counts: {
    total: number;
    pending: number;
    in_progress: number;
    blocked: number;
    done: number;
    skipped: number;
  };
};

type FilterKey = 'all' | WorkOrderStatus;

export function WorkOrdersList({ workOrders }: { workOrders: WorkOrderRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    let result = workOrders;
    if (filter !== 'all') result = result.filter((w) => w.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.folio.toLowerCase().includes(q) ||
          w.title.toLowerCase().includes(q) ||
          w.client?.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, filter, search]);

  const counts = useMemo(() => {
    const c = (s: WorkOrderStatus) =>
      workOrders.filter((w) => w.status === s).length;
    return {
      all: workOrders.length,
      pending: c('pending'),
      in_production: c('in_production'),
      review: c('review'),
      ready: c('ready'),
      published: c('published'),
      cancelled: c('cancelled'),
    };
  }, [workOrders]);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, título o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 border border-border rounded-md p-1 bg-card overflow-x-auto">
          <FilterButton label="Todos" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterButton label="Pendientes" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <FilterButton label="En producción" count={counts.in_production} active={filter === 'in_production'} onClick={() => setFilter('in_production')} />
          <FilterButton label="En revisión" count={counts.review} active={filter === 'review'} onClick={() => setFilter('review')} />
          <FilterButton label="Listas" count={counts.ready} active={filter === 'ready'} onClick={() => setFilter('ready')} />
          <FilterButton label="Publicadas" count={counts.published} active={filter === 'published'} onClick={() => setFilter('published')} />
          {counts.cancelled > 0 && (
            <FilterButton label="Canceladas" count={counts.cancelled} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <Th>Folio</Th>
                <Th>Pieza</Th>
                <Th>Cliente</Th>
                <Th>Owner</Th>
                <Th>Deadline</Th>
                <Th>Tareas</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((wo) => {
                const dl = deadlineInfo(wo.deadline);
                const showDeadline = !['published', 'cancelled'].includes(
                  wo.status
                );
                return (
                  <tr
                    key={wo.id}
                    onClick={() => router.push(`/work-orders/${wo.id}`)}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {wo.folio}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {wo.source_schedule_item && (
                          <ItemTypeBadge
                            type={wo.source_schedule_item.item_type}
                          />
                        )}
                        <span className="font-medium truncate max-w-[220px]">
                          {wo.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{wo.client?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <UserChip user={wo.owner} />
                    </td>
                    <td className="px-4 py-3">
                      {showDeadline ? (
                        <span
                          className={`text-xs font-mono ${DEADLINE_TONE_CLASS[dl.tone]}`}
                        >
                          {dl.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className="font-medium">{wo.task_counts.total}</span>{' '}
                      <span className="text-muted-foreground">total · </span>
                      <span className="text-green-500 font-medium">
                        {wo.task_counts.done}
                      </span>{' '}
                      <span className="text-muted-foreground">done</span>
                      {wo.task_counts.blocked > 0 && (
                        <span className="text-destructive">
                          {' · '}
                          {wo.task_counts.blocked} bloq.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <WorkOrderStatusBadge status={wo.status} />
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
              : 'No hay OTs en este filtro'}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
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
        className={`font-mono tabular-nums ${active ? 'text-black/70' : 'text-muted-foreground'}`}
      >
        {count}
      </span>
    </button>
  );
}
