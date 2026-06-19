'use client';

import { Search, MessagesSquare, Loader2, AlertCircle } from 'lucide-react';
import type { ConversationWithRelations } from '@/lib/types/database';
import {
  conversationName,
  initials,
  avatarColor,
  relativeTime,
  platformLabel,
} from './utils';

export type StatusFilter = 'open' | 'unread' | 'mine' | 'archived';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Todas' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'mine', label: 'Mías' },
  { key: 'archived', label: 'Archivadas' },
];

interface Props {
  conversations: ConversationWithRelations[];
  selectedId: string | null;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
}

export function ConversationList({
  conversations,
  selectedId,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  onSelect,
  loading,
  error,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((c) => {
        const name = conversationName(c).toLowerCase();
        return (
          name.includes(q) ||
          c.remote_phone?.toLowerCase().includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-photocan-amber" />
            Conversaciones
          </h1>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {filtered.length}
          </span>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o mensaje..."
            className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary border border-border text-sm outline-none focus:border-photocan-amber/50"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onStatusFilterChange(f.key)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === f.key
                  ? 'bg-photocan-amber text-black border-photocan-amber'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {error && (
          <div className="m-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading && conversations.length === 0 ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyList hasSearch={!!q} />
        ) : (
          filtered.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              selected={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation: c,
  selected,
  onClick,
}: {
  conversation: ConversationWithRelations;
  selected: boolean;
  onClick: () => void;
}) {
  const name = conversationName(c);
  const preview = c.last_message_preview
    ? c.last_message_preview.slice(0, 50) +
      (c.last_message_preview.length > 50 ? '…' : '')
    : 'Sin mensajes';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 transition-colors ${
        selected ? 'bg-secondary' : 'hover:bg-secondary/50'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-full grid place-items-center text-sm font-semibold flex-shrink-0 ${avatarColor(
          name
        )}`}
      >
        {initials(name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{name}</span>
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
            {relativeTime(c.last_message_at)}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 mb-0.5">
          {c.remote_phone && <span className="truncate">{c.remote_phone}</span>}
          <span className="px-1 rounded bg-secondary border border-border">
            {platformLabel(c.platform)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground truncate">
            {c.last_message_direction === 'outbound' && (
              <span className="text-muted-foreground/70">Tú: </span>
            )}
            {preview}
          </span>
          {c.unread_count > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-photocan-amber text-black text-[10px] font-bold grid place-items-center tabular-nums">
              {c.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyList({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-3">
        <MessagesSquare className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
        {hasSearch
          ? 'Ninguna conversación coincide con tu búsqueda.'
          : 'Sin conversaciones todavía. Los mensajes que reciban aparecerán aquí.'}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-secondary flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-secondary rounded w-1/2" />
            <div className="h-3 bg-secondary rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
