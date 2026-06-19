'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MoreVertical,
  MailOpen,
  UserCheck,
  UserX,
  Tag,
  Bot,
  BotOff,
  Archive,
  ArchiveRestore,
  Loader2,
} from 'lucide-react';
import {
  markConversationAsUnreadAction,
  assignConversationAction,
  toggleAgentHandlesAction,
  archiveConversationAction,
  unarchiveConversationAction,
} from '@/lib/actions/conversations';
import type { ConversationWithRelations } from '@/lib/types/database';

interface Props {
  conversation: ConversationWithRelations;
  currentUserId: string | null;
  canManage: boolean;
  canAssign: boolean;
  canArchive: boolean;
  onAssociateClient: () => void;
  onChanged: () => void;
}

export function ConversationActionsMenu({
  conversation,
  currentUserId,
  canManage,
  canAssign,
  canArchive,
  onAssociateClient,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function run(fn: () => Promise<{ error?: string } | void>) {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    setOpen(false);
    if (result && 'error' in result && result.error) {
      // El detalle muestra errores de forma global; aquí basta con loguear.
      console.error('[ConversationActions]', result.error);
    }
    onChanged();
  }

  const isArchived = conversation.status === 'archived';
  const assignedToMe =
    !!currentUserId && conversation.assigned_to_user_id === currentUserId;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="h-9 w-9 rounded-md grid place-items-center hover:bg-secondary text-muted-foreground disabled:opacity-50"
        aria-label="Acciones"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-background border border-border rounded-lg shadow-xl py-1 z-50">
          <MenuItem
            icon={<MailOpen className="w-4 h-4" />}
            label="Marcar como no leído"
            onClick={() =>
              run(() => markConversationAsUnreadAction(conversation.id))
            }
          />

          {canAssign && currentUserId && (
            <MenuItem
              icon={
                assignedToMe ? (
                  <UserX className="w-4 h-4" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )
              }
              label={assignedToMe ? 'Quitar mi asignación' : 'Asignármela'}
              onClick={() =>
                run(() =>
                  assignConversationAction({
                    conversation_id: conversation.id,
                    assigned_to_user_id: assignedToMe ? null : currentUserId,
                  })
                )
              }
            />
          )}

          {canManage && (
            <MenuItem
              icon={<Tag className="w-4 h-4" />}
              label="Asociar cliente"
              onClick={() => {
                setOpen(false);
                onAssociateClient();
              }}
            />
          )}

          {canManage && (
            <MenuItem
              icon={
                conversation.agent_handles ? (
                  <BotOff className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )
              }
              label={
                conversation.agent_handles
                  ? 'Tomar control (pausar agente)'
                  : 'Devolver al agente IA'
              }
              onClick={() =>
                run(() =>
                  toggleAgentHandlesAction({
                    conversation_id: conversation.id,
                    agent_handles: !conversation.agent_handles,
                  })
                )
              }
            />
          )}

          {canArchive && (
            <>
              <div className="my-1 border-t border-border" />
              {isArchived ? (
                <MenuItem
                  icon={<ArchiveRestore className="w-4 h-4" />}
                  label="Desarchivar"
                  onClick={() =>
                    run(() => unarchiveConversationAction(conversation.id))
                  }
                />
              ) : (
                <MenuItem
                  icon={<Archive className="w-4 h-4" />}
                  label="Archivar"
                  onClick={() =>
                    run(() => archiveConversationAction(conversation.id))
                  }
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-secondary text-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}
