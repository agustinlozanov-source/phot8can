'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import {
  listConversationsAction,
  markConversationAsReadAction,
} from '@/lib/actions/conversations';
import type {
  ConversationWithRelations,
  Message,
} from '@/lib/types/database';
import { ConversationList, type StatusFilter } from './conversation-list';
import { ConversationDetail } from './conversation-detail';

interface Props {
  initialConversations: ConversationWithRelations[];
  initialSelectedId: string | null;
  initialConversation: ConversationWithRelations | null;
  initialMessages: Message[];
  canManage: boolean;
  canAssign: boolean;
  canArchive: boolean;
  currentUserId: string | null;
}

const REFRESH_MS = 30_000;

export function ConversationsView({
  initialConversations,
  initialSelectedId,
  initialConversation,
  initialMessages,
  canManage,
  canAssign,
  canArchive,
  currentUserId,
}: Props) {
  const [conversations, setConversations] = useState<
    ConversationWithRelations[]
  >(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterRef = useRef(statusFilter);
  filterRef.current = statusFilter;

  const load = useCallback(async (filter: StatusFilter) => {
    setLoading(true);
    setError(null);
    const params =
      filter === 'open'
        ? { status: 'open' as const }
        : filter === 'unread'
          ? { status: 'open' as const, unread_only: true }
          : filter === 'mine'
            ? { status: 'open' as const, assigned_to_user_id: 'me' }
            : { status: 'archived' as const };

    const result = await listConversationsAction(params);
    if ('error' in result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if ('conversations' in result) {
      setConversations(result.conversations as never);
    }
    setLoading(false);
  }, []);

  // Recargar al cambiar de filtro
  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  // Auto-refresh cada 30s con el filtro vigente
  useEffect(() => {
    const id = setInterval(() => {
      load(filterRef.current);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    // Actualizar URL sin re-render del server (preserva el estado del cliente)
    window.history.replaceState(null, '', `/conversations?conversation_id=${id}`);
    // Marcar como leída + optimistic
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
    await markConversationAsReadAction(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, '', '/conversations');
  }, []);

  // Refrescar lista tras una acción o envío
  const refreshList = useCallback(() => {
    load(filterRef.current);
  }, [load]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex flex-1 min-h-0">
        {/* Lista lateral */}
        <div
          className={`w-full md:w-[380px] md:flex-shrink-0 border-r border-border flex-col min-h-0 ${
            selectedId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelect}
            loading={loading}
            error={error}
          />
        </div>

        {/* Detalle / chat */}
        <div
          className={`flex-1 min-h-0 ${
            selectedId ? 'flex' : 'hidden md:flex'
          } flex-col`}
        >
          {selectedId ? (
            <ConversationDetail
              key={selectedId}
              conversationId={selectedId}
              initialConversation={
                initialConversation?.id === selectedId
                  ? initialConversation
                  : (selected ?? null)
              }
              initialMessages={
                initialConversation?.id === selectedId ? initialMessages : []
              }
              canManage={canManage}
              canAssign={canAssign}
              canArchive={canArchive}
              currentUserId={currentUserId}
              onBack={handleBack}
              onChanged={refreshList}
            />
          ) : (
            <EmptyDetail />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex-1 grid place-items-center p-8 text-center">
      <div>
        <div className="w-16 h-16 rounded-full bg-secondary border border-border grid place-items-center mx-auto mb-4">
          <MessagesSquare className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="font-medium mb-1">
          Selecciona una conversación para ver el chat
        </div>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Elige una conversación de la lista para leer y responder los mensajes.
        </p>
      </div>
    </div>
  );
}
