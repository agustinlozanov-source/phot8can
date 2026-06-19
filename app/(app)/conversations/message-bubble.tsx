'use client';

import { useState } from 'react';
import { Check, CheckCheck, AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import type { Message, MessageAIMetadata } from '@/lib/types/database';
import { retryFailedMessageAction } from '@/lib/actions/conversations';
import { formatTime } from './utils';

export type MessageWithSender = Message & {
  sender?: { id: string; first_name: string | null; last_name: string | null } | null;
};

interface Props {
  message: MessageWithSender;
  showSender: boolean;
  canManage: boolean;
  onRetried?: () => void;
}

export function MessageBubble({ message, showSender, canManage, onRetried }: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Eventos del sistema: centrados
  if (message.sender_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs italic text-muted-foreground px-3 py-1 rounded-full bg-secondary/50">
          {message.content}
        </span>
      </div>
    );
  }

  const isInbound = message.direction === 'inbound';
  const isAgent = message.sender_type === 'agent';
  const ai = (message.ai_metadata as MessageAIMetadata | null) ?? null;
  const escalation = ai?.escalation_suggested === true;

  const senderName = message.sender
    ? [message.sender.first_name, message.sender.last_name]
        .filter(Boolean)
        .join(' ')
    : null;

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    const result = await retryFailedMessageAction(message.id);
    setRetrying(false);
    if (result?.error) {
      setRetryError(result.error);
      return;
    }
    onRetried?.();
  }

  // Estilo de burbuja según origen
  const bubbleClass = isInbound
    ? 'bg-secondary text-foreground rounded-2xl rounded-bl-sm'
    : isAgent
      ? `bg-zinc-800 text-zinc-100 rounded-2xl rounded-br-sm ${
          escalation ? 'border border-photocan-amber' : ''
        }`
      : 'bg-photocan-amber text-black rounded-2xl rounded-br-sm';

  return (
    <div className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
      {showSender && (isAgent || senderName) && (
        <div
          className={`text-[10px] font-mono mb-0.5 px-1 ${
            isInbound ? 'text-left' : 'text-right'
          } text-muted-foreground`}
        >
          {isAgent ? (
            <span className="inline-flex items-center gap-1 text-photocan-amber-deep font-semibold uppercase tracking-wider">
              {escalation && <AlertTriangle className="w-3 h-3" />}
              Agente IA
            </span>
          ) : (
            senderName
          )}
        </div>
      )}

      <div className={`max-w-[78%] px-3 py-2 ${bubbleClass}`}>
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <div
          className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
            isInbound || isAgent ? 'text-muted-foreground' : 'text-black/60'
          }`}
        >
          <span className="font-mono">{formatTime(message.created_at)}</span>
          {!isInbound && <StatusIcon status={message.status} />}
        </div>
      </div>

      {message.status === 'failed' && !isInbound && (
        <div className="flex flex-col items-end mt-1">
          {message.failure_reason && (
            <span className="text-[10px] text-destructive max-w-[78%] text-right">
              {message.failure_reason}
            </span>
          )}
          {canManage && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-[11px] text-photocan-amber-deep hover:underline mt-0.5 disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCw className="w-3 h-3" />
              )}
              Reintentar
            </button>
          )}
          {retryError && (
            <span className="text-[10px] text-destructive mt-0.5">
              {retryError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'pending') return <Loader2 className="w-3 h-3 animate-spin" />;
  if (status === 'sent') return <Check className="w-3 h-3" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3" />;
  if (status === 'read')
    return <CheckCheck className="w-3 h-3 text-sky-500" />;
  if (status === 'failed')
    return <AlertTriangle className="w-3 h-3 text-destructive" />;
  return null;
}
