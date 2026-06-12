'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mic,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type {
  Interview,
  InterviewStatus,
  InterviewMode,
} from '@/lib/types/database';

type InterviewWithRelations = Interview & {
  client: { id: string; name: string } | null;
  creator: { id: string; first_name: string; last_name: string } | null;
};

type FilterStatus = 'all' | InterviewStatus;

export function InterviewsList({
  interviews,
}: {
  interviews: InterviewWithRelations[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    let result = interviews;

    if (filter !== 'all') {
      result = result.filter((i) => i.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.client?.name.toLowerCase().includes(q) ||
          i.creator?.first_name.toLowerCase().includes(q) ||
          i.creator?.last_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [interviews, filter, search]);

  const counts = useMemo(() => {
    return {
      all: interviews.length,
      pending: interviews.filter((i) => i.status === 'pending').length,
      in_progress: interviews.filter((i) => i.status === 'in_progress').length,
      completed: interviews.filter((i) =>
        ['completed', 'processing'].includes(i.status)
      ).length,
      failed: interviews.filter((i) => i.status === 'failed').length,
    };
  }, [interviews]);

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o creador..."
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
          label="Pendientes"
          count={counts.pending}
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <FilterButton
          label="En curso"
          count={counts.in_progress}
          active={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
        />
        <FilterButton
          label="Completadas"
          count={counts.completed}
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
        />
        {counts.failed > 0 && (
          <FilterButton
            label="Fallidas"
            count={counts.failed}
            active={filter === 'failed'}
            onClick={() => setFilter('failed')}
          />
        )}
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
                  Modo
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estado
                </th>
                <th className="text-center px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Turnos
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Creada
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Por
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((interview) => {
                const transcript = (interview.transcript as unknown as unknown[]) || [];
                const turnCount = transcript.length;

                return (
                  <tr
                    key={interview.id}
                    onClick={() =>
                      router.push(`/strategy/interviews/${interview.id}`)
                    }
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {interview.client?.name || 'Cliente eliminado'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ModeBadge mode={interview.mode} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={interview.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm">{turnCount}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(interview.created_at).toLocaleDateString(
                        'es-MX',
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {interview.creator
                        ? `${interview.creator.first_name} ${interview.creator.last_name}`
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
              : 'No hay entrevistas en este filtro'}
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

function ModeBadge({ mode }: { mode: InterviewMode }) {
  if (mode === 'voice') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Mic className="w-3 h-3 text-purple-500" />
        Voz
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <MessageSquare className="w-3 h-3 text-blue-500" />
      Texto
    </span>
  );
}

function StatusBadge({ status }: { status: InterviewStatus }) {
  const config = {
    pending: {
      label: 'Pendiente',
      Icon: Clock,
      bg: 'bg-secondary text-muted-foreground',
    },
    in_progress: {
      label: 'En curso',
      Icon: MessageSquare,
      bg: 'bg-photocan-amber/10 text-photocan-amber-deep',
    },
    completed: {
      label: 'Completada',
      Icon: CheckCircle2,
      bg: 'bg-green-500/10 text-green-500',
    },
    processing: {
      label: 'Procesando',
      Icon: Loader2,
      bg: 'bg-blue-500/10 text-blue-500',
    },
    failed: {
      label: 'Fallida',
      Icon: AlertCircle,
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
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}
