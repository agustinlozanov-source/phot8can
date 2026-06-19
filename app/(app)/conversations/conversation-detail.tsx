'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  PanelRightOpen,
  X,
  Loader2,
  AlertCircle,
  Bot,
  User as UserIcon,
  Building2,
  History,
} from 'lucide-react';
import {
  getConversationByIdAction,
  listMessagesAction,
  listConversationEventsAction,
} from '@/lib/actions/conversations';
import type {
  ConversationWithRelations,
  Message,
  ConversationEvent,
} from '@/lib/types/database';
import { MessageBubble, type MessageWithSender } from './message-bubble';
import { ComposeArea } from './compose-area';
import { ConversationActionsMenu } from './conversation-actions-menu';
import { AssociateClientModal } from './associate-client-modal';
import {
  conversationName,
  initials,
  avatarColor,
  platformLabel,
  formatDaySeparator,
  dayKey,
  isOutside24hWindow,
  relativeTime,
} from './utils';

type EventWithActor = ConversationEvent & {
  actor?: { first_name: string | null; last_name: string | null } | null;
};

interface Props {
  conversationId: string;
  initialConversation: ConversationWithRelations | null;
  initialMessages: Message[];
  canManage: boolean;
  canAssign: boolean;
  canArchive: boolean;
  currentUserId: string | null;
  onBack: () => void;
  onChanged: () => void;
}

const POLL_MS = 15_000;

export function ConversationDetail({
  conversationId,
  initialConversation,
  initialMessages,
  canManage,
  canAssign,
  canArchive,
  currentUserId,
  onBack,
  onChanged,
}: Props) {
  const [conversation, setConversation] =
    useState<ConversationWithRelations | null>(initialConversation);
  const [messages, setMessages] = useState<MessageWithSender[]>(
    initialMessages as MessageWithSender[]
  );
  const [loading, setLoading] = useState(!initialConversation);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showAssociate, setShowAssociate] = useState(false);
  const [events, setEvents] = useState<EventWithActor[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const loadMessages = useCallback(async () => {
    const result = await listMessagesAction(conversationId);
    if ('messages' in result) {
      setMessages(result.messages as MessageWithSender[]);
    }
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    const result = await getConversationByIdAction(conversationId);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    if ('conversation' in result) setConversation(result.conversation as never);
  }, [conversationId]);

  const reload = useCallback(async () => {
    await Promise.all([loadConversation(), loadMessages()]);
    onChanged();
  }, [loadConversation, loadMessages, onChanged]);

  // Carga inicial (si no vino precargada) + refresco al cambiar de conversación
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(!initialConversation);
      setError(null);
      const [convRes, msgRes] = await Promise.all([
        getConversationByIdAction(conversationId),
        listMessagesAction(conversationId),
      ]);
      if (!active) return;
      if ('error' in convRes && convRes.error) setError(convRes.error);
      else if ('conversation' in convRes)
        setConversation(convRes.conversation as never);
      if ('messages' in msgRes) setMessages(msgRes.messages as MessageWithSender[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Poll de mensajes
  useEffect(() => {
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  // Auto-scroll al final cuando llegan/parten mensajes
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Cargar eventos al abrir el panel
  useEffect(() => {
    if (!showPanel) return;
    (async () => {
      const result = await listConversationEventsAction(conversationId);
      if ('events' in result) setEvents(result.events as EventWithActor[]);
    })();
  }, [showPanel, conversationId]);

  if (loading && !conversation) {
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <div className="text-center">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!conversation) return null;

  const name = conversationName(conversation);
  const archived = conversation.status === 'archived';
  const outside24h = isOutside24hWindow(conversation);

  return (
    <div className="flex flex-1 min-h-0 relative">
      {/* Columna principal: chat */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button
            onClick={onBack}
            className="md:hidden h-9 w-9 grid place-items-center rounded-md hover:bg-secondary -ml-1"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            className={`w-10 h-10 rounded-full grid place-items-center text-sm font-semibold flex-shrink-0 ${avatarColor(
              name
            )}`}
          >
            {initials(name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-medium truncate flex items-center gap-2">
              {name}
              {conversation.agent_handles && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-photocan-amber-deep">
                  <Bot className="w-3 h-3" />
                  IA
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              {conversation.remote_phone && (
                <span className="truncate">{conversation.remote_phone}</span>
              )}
              <span>·</span>
              <span>{platformLabel(conversation.platform)}</span>
              <span>·</span>
              <span className={archived ? '' : 'text-green-500'}>
                {archived ? 'Archivada' : 'Activo'}
              </span>
            </div>
            {conversation.client && (
              <div className="text-[11px] text-muted-foreground">
                Cliente:{' '}
                <Link
                  href={`/clients/${conversation.client.id}`}
                  className="text-photocan-amber-deep hover:underline"
                >
                  {conversation.client.name}
                </Link>
              </div>
            )}
          </div>

          <ConversationActionsMenu
            conversation={conversation}
            currentUserId={currentUserId}
            canManage={canManage}
            canAssign={canAssign}
            canArchive={canArchive}
            onAssociateClient={() => setShowAssociate(true)}
            onChanged={reload}
          />
          <button
            onClick={() => setShowPanel((s) => !s)}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Ver detalles"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Mensajes */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-1.5"
        >
          {messages.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              No hay mensajes en esta conversación.
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const showDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
              const sameSender =
                prev &&
                prev.sender_type === m.sender_type &&
                prev.sender_user_id === m.sender_user_id &&
                prev.direction === m.direction;
              const showSender = !sameSender || showDay;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                        {formatDaySeparator(m.created_at)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={m}
                    showSender={showSender}
                    canManage={canManage}
                    onRetried={reload}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Composición */}
        <ComposeArea
          conversationId={conversationId}
          canManage={canManage}
          archived={archived}
          outside24h={outside24h}
          onSent={reload}
        />
      </div>

      {/* Panel de contexto */}
      {showPanel && (
        <ContextPanel
          conversation={conversation}
          events={events}
          canManage={canManage}
          onClose={() => setShowPanel(false)}
          onAssociateClient={() => setShowAssociate(true)}
        />
      )}

      {showAssociate && (
        <AssociateClientModal
          conversationId={conversationId}
          hasClient={!!conversation.client_id}
          onClose={() => setShowAssociate(false)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function ContextPanel({
  conversation,
  events,
  canManage,
  onClose,
  onAssociateClient,
}: {
  conversation: ConversationWithRelations;
  events: EventWithActor[];
  canManage: boolean;
  onClose: () => void;
  onAssociateClient: () => void;
}) {
  return (
    <div className="w-full md:w-[300px] md:flex-shrink-0 border-l border-border flex flex-col min-h-0 absolute md:static inset-0 bg-background z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-medium text-sm">Detalles</h3>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
        {/* Contacto */}
        <section>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <UserIcon className="w-3 h-3" />
            Contacto
          </h4>
          <dl className="space-y-1 text-sm">
            <Row label="Nombre" value={conversationName(conversation)} />
            <Row label="Teléfono" value={conversation.remote_phone} mono />
            <Row label="Usuario" value={conversation.remote_handle} mono />
            <Row label="Plataforma" value={platformLabel(conversation.platform)} />
          </dl>
        </section>

        {/* Cliente */}
        <section>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            Cliente
          </h4>
          {conversation.client ? (
            <Link
              href={`/clients/${conversation.client.id}`}
              className="block text-sm text-photocan-amber-deep hover:underline"
            >
              {conversation.client.name}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Sin cliente asociado</p>
          )}
          {canManage && (
            <button
              onClick={onAssociateClient}
              className="mt-2 text-xs text-photocan-amber-deep hover:underline"
            >
              {conversation.client ? 'Cambiar cliente' : 'Asociar cliente'}
            </button>
          )}
        </section>

        {/* Eventos */}
        <section>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <History className="w-3 h-3" />
            Historial
          </h4>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => {
                const actor = e.actor
                  ? [e.actor.first_name, e.actor.last_name]
                      .filter(Boolean)
                      .join(' ')
                  : null;
                return (
                  <li key={e.id} className="text-xs">
                    <div className="text-foreground">
                      {e.description || e.event_type}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      {actor ? `${actor} · ` : ''}
                      {relativeTime(e.created_at)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
