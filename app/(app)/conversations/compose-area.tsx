'use client';

import { useRef, useState } from 'react';
import { Send, Loader2, AlertCircle, Clock } from 'lucide-react';
import { sendMessageAction } from '@/lib/actions/conversations';

const MAX_CHARS = 4096;

interface Props {
  conversationId: string;
  canManage: boolean;
  archived: boolean;
  outside24h: boolean;
  onSent: () => void;
}

export function ComposeArea({
  conversationId,
  canManage,
  archived,
  outside24h,
  onSent,
}: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hardDisabled = !canManage || archived || outside24h;

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  async function handleSend() {
    const text = content.trim();
    if (!text || sending || hardDisabled) return;

    setSending(true);
    setError(null);
    const result = await sendMessageAction({
      conversation_id: conversationId,
      content: text,
    });
    setSending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if ('failed' in result && result.failed) {
      setError('El mensaje no se pudo entregar. Puedes reintentarlo abajo.');
    }
    onSent();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Banners de estado bloqueante
  if (!canManage) {
    return (
      <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
        No tienes permiso para enviar mensajes en esta conversación.
      </div>
    );
  }
  if (archived) {
    return (
      <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
        Esta conversación está archivada. Desarchívala para poder responder.
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {outside24h && (
        <div className="px-4 pt-3">
          <div className="rounded-md border border-photocan-amber/40 bg-photocan-amber/5 px-3 py-2 text-xs text-photocan-amber-deep flex items-start gap-2">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Esta conversación está fuera del rango de 24 horas. Solo puedes enviar
            mensajes plantilla aprobados (no soportado todavía).
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        </div>
      )}

      <div className="p-3 flex items-end gap-2">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, MAX_CHARS));
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
            disabled={hardDisabled || sending}
            rows={1}
            placeholder={
              outside24h ? 'Fuera de la ventana de 24h' : 'Escribe un mensaje...'
            }
            className="w-full resize-none rounded-2xl bg-secondary border border-border px-4 py-2.5 text-sm outline-none focus:border-photocan-amber/50 disabled:opacity-60 max-h-[120px]"
          />
          {content.length > 0 && (
            <div className="text-[10px] font-mono text-muted-foreground text-right mt-1 pr-2">
              {content.length}/{MAX_CHARS}
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={hardDisabled || sending || !content.trim()}
          className="h-10 w-10 rounded-full bg-photocan-amber text-black grid place-items-center flex-shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
          aria-label="Enviar"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
