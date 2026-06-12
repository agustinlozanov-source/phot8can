'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Archive,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Strategy, StrategyStatus } from '@/lib/types/database';

type StrategyWithRelations = Strategy & {
  client: { id: string; name: string } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

type FilterStatus = 'all' | StrategyStatus;

interface Props {
  strategies: StrategyWithRelations[];
  layersByStrategy: Record<string, { total: number; approved: number }>;
}

export function StrategiesList({ strategies, layersByStrategy }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = strategies;

    if (filter !== 'all') {
      result = result.filter((s) => s.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.client?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [strategies, filter, search]);

  const counts = useMemo(() => {
    return {
      all: strategies.length,
      draft: strategies.filter((s) => s.status === 'draft').length,
      review: strategies.filter((s) => s.status === 'review').length,
      sent: strategies.filter((s) =>
        ['sent', 'viewed'].includes(s.status)
      ).length,
      approved: strategies.filter((s) => s.status === 'approved').length,
      rejected: strategies.filter((s) => s.status === 'rejected').length,
      archived: strategies.filter((s) => s.status === 'archived').length,
    };
  }, [strategies]);

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título o cliente..."
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
          label="En revisión"
          count={counts.draft + counts.review}
          active={filter === 'draft'}
          onClick={() => setFilter('draft')}
        />
        <FilterButton
          label="Enviadas"
          count={counts.sent}
          active={filter === 'sent'}
          onClick={() => setFilter('sent')}
        />
        <FilterButton
          label="Aprobadas"
          count={counts.approved}
          active={filter === 'approved'}
          onClick={() => setFilter('approved')}
        />
        {counts.rejected > 0 && (
          <FilterButton
            label="Rechazadas"
            count={counts.rejected}
            active={filter === 'rejected'}
            onClick={() => setFilter('rejected')}
          />
        )}
        {counts.archived > 0 && (
          <FilterButton
            label="Archivadas"
            count={counts.archived}
            active={filter === 'archived'}
            onClick={() => setFilter('archived')}
          />
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estrategia
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="text-center px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Capas
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Generada
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((strategy) => {
                const layers = layersByStrategy[strategy.id] || {
                  total: 0,
                  approved: 0,
                };

                return (
                  <tr
                    key={strategy.id}
                    onClick={() =>
                      router.push(`/strategy/strategies/${strategy.id}`)
                    }
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium line-clamp-1">
                        {strategy.title}
                      </div>
                      {strategy.version > 1 && (
                        <div className="text-[10px] font-mono text-muted-foreground">
                          v{strategy.version}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {strategy.client?.name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm">
                        {layers.approved}/{layers.total}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={strategy.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(strategy.generated_at).toLocaleDateString(
                        'es-MX',
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }
                      )}
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
              : 'No hay estrategias en este filtro'}
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

function StatusBadge({ status }: { status: StrategyStatus }) {
  const config = {
    draft: {
      label: 'En revisión',
      Icon: FileText,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    review: {
      label: 'En revisión',
      Icon: FileText,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    sent: {
      label: 'Enviada al cliente',
      Icon: Send,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    viewed: {
      label: 'Vista por cliente',
      Icon: Eye,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    approved: {
      label: 'Aprobada',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    rejected: {
      label: 'Rechazada',
      Icon: XCircle,
      bg: 'bg-destructive/10 text-destructive',
    },
    archived: {
      label: 'Archivada',
      Icon: Archive,
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
