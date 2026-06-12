'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import type { InterviewTurn } from '@/lib/types/database';

interface Props {
  token: string;
  interviewId: string;
  initialTranscript: InterviewTurn[];
  clientName: string;
  interviewerName: string;
  orgName: string;
  orgColor: string;
  isResuming: boolean;
}

export function InterviewChat({
  token,
  interviewId,
  initialTranscript,
  clientName,
  interviewerName,
  orgName,
  orgColor,
  isResuming,
}: Props) {
  const [messages, setMessages] = useState<InterviewTurn[]>(initialTranscript);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [hasStarted, setHasStarted] = useState(initialTranscript.length > 0);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Si nunca ha empezado, le pedimos al servidor el primer mensaje de Lía
  async function startInterview() {
    setHasStarted(true);
    await sendMessage('', true); // mensaje vacío = pedimos saludo inicial
  }

  async function sendMessage(content: string, isInitial: boolean = false) {
    if (!isInitial && (!content.trim() || isStreaming)) return;

    setError(null);

    const userMessage: InterviewTurn = isInitial
      ? null!
      : {
          role: 'user',
          content: content.trim(),
          at: new Date().toISOString(),
        };

    if (!isInitial) {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
    }

    setIsStreaming(true);
    setStreamingMessage('');

    try {
      const response = await fetch('/api/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user_message: isInitial ? '' : content.trim(),
          is_initial: isInitial,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error ${response.status}: ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error('No se recibió respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamingMessage(fullText);
      }

      // Al terminar el stream, mover el mensaje completo al array de messages
      const assistantMessage: InterviewTurn = {
        role: 'assistant',
        content: fullText,
        at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage('');
    } catch (err) {
      console.error('[chat] Error:', err);
      setError(
        err instanceof Error ? err.message : 'Error inesperado'
      );
      setStreamingMessage('');
      // Si era inicial y falló, permitir reintentar
      if (isInitial) {
        setHasStarted(false);
      }
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleFinish() {
    setIsFinishing(true);
    setError(null);

    try {
      const response = await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al terminar entrevista');
      }

      setIsFinished(true);
      setShowFinishConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsFinishing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Pantalla de finalización
  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div
            className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6"
            style={{ background: `${orgColor}20`, border: `2px solid ${orgColor}40` }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: orgColor }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            ¡Gracias!
          </h1>
          <p className="text-muted-foreground mb-2">
            Ya tenemos toda la información que necesitamos.
          </p>
          <p className="text-sm text-muted-foreground">
            En unos minutos {orgName} va a preparar tu estrategia. Te avisarán
            cuando esté lista.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de bienvenida (antes de empezar)
  if (!hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div
            className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-6"
            style={{ background: `${orgColor}15`, border: `2px solid ${orgColor}30` }}
          >
            <Sparkles className="w-8 h-8" style={{ color: orgColor }} />
          </div>
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: orgColor }}
          >
            {orgName}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            Vamos a conocer {clientName}
          </h1>
          <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
            Soy {interviewerName}, la estratega de IA que va a entrevistarte. Vamos
            a tener una conversación natural sobre tu negocio: cómo nació, a
            quién le vendes, qué te diferencia, qué sueñas lograr.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Toma el tiempo que necesites. Cuando sientas que ya cubrimos todo,
            puedes terminar la entrevista.
          </p>

          <button
            onClick={startInterview}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md text-black font-medium hover:opacity-90 transition-opacity"
            style={{ background: orgColor }}
          >
            Empezar entrevista
            <Send className="w-4 h-4" />
          </button>

          <p className="text-xs text-muted-foreground mt-6">
            Esta conversación durará entre 15 y 30 minutos.
          </p>
        </div>
      </div>
    );
  }

  // Chat normal
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
              style={{ background: `${orgColor}15`, border: `1px solid ${orgColor}30` }}
            >
              <Sparkles className="w-4 h-4" style={{ color: orgColor }} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm">{interviewerName}</div>
              <div className="text-xs text-muted-foreground truncate">
                Entrevista para {clientName}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={messages.length < 4 || isStreaming}
            className="text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Terminar entrevista
          </button>
        </div>
      </div>

      {/* Aviso de retomar */}
      {isResuming && messages.length > 0 && (
        <div className="max-w-3xl w-full mx-auto px-6 pt-3">
          <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-xs flex items-start gap-2">
            <AlertCircle
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              style={{ color: orgColor }}
            />
            <div>
              Estás retomando tu entrevista. Continuamos donde la dejaste.
            </div>
          </div>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {messages.map((message, idx) => (
            <MessageBubble
              key={idx}
              message={message}
              interviewerName={interviewerName}
              orgColor={orgColor}
            />
          ))}

          {streamingMessage && (
            <MessageBubble
              message={{
                role: 'assistant',
                content: streamingMessage,
                at: new Date().toISOString(),
              }}
              interviewerName={interviewerName}
              orgColor={orgColor}
              isStreaming
            />
          )}

          {isStreaming && !streamingMessage && (
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
                style={{ background: `${orgColor}15`, border: `1px solid ${orgColor}30` }}
              >
                <Sparkles
                  className="w-4 h-4 animate-pulse"
                  style={{ color: orgColor }}
                />
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: orgColor, animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: orgColor, animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: orgColor, animationDelay: '300ms' }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/30 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? `${interviewerName} está escribiendo...`
                  : 'Escribe tu respuesta...'
              }
              rows={1}
              className="w-full resize-none rounded-2xl border border-input bg-background pl-4 pr-14 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-photocan-amber disabled:opacity-50"
              style={{ minHeight: '48px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-full grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
              style={{ background: orgColor, color: '#000' }}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="text-xs text-muted-foreground text-center mt-2">
            Presiona Enter para enviar · Shift + Enter para salto de línea
          </div>
        </div>
      </div>

      {/* Modal confirmar finalización */}
      {showFinishConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={isFinishing ? undefined : () => setShowFinishConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">¿Terminar entrevista?</h3>
              <button
                onClick={() => setShowFinishConfirm(false)}
                disabled={isFinishing}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Después de terminar, {orgName} va a generar tu estrategia
                automáticamente con base en lo que conversamos.
              </p>
              <p className="text-sm text-muted-foreground">
                Si crees que todavía hay cosas importantes que cubrir,
                continúa la conversación.
              </p>
            </div>
            <div className="p-6 border-t border-border flex gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                disabled={isFinishing}
                className="flex-1 h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Continuar entrevista
              </button>
              <button
                onClick={handleFinish}
                disabled={isFinishing}
                className="flex-1 h-10 rounded-md text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{ background: orgColor }}
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Terminar y enviar'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// MESSAGE BUBBLE
// ============================================================

function MessageBubble({
  message,
  interviewerName,
  orgColor,
  isStreaming = false,
}: {
  message: InterviewTurn;
  interviewerName: string;
  orgColor: string;
  isStreaming?: boolean;
}) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`flex items-start gap-3 ${
        isAssistant ? 'justify-start' : 'justify-end'
      }`}
    >
      {isAssistant && (
        <div
          className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
          style={{ background: `${orgColor}15`, border: `1px solid ${orgColor}30` }}
        >
          <Sparkles className="w-4 h-4" style={{ color: orgColor }} />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? 'bg-secondary rounded-tl-sm'
            : 'bg-photocan-amber text-black rounded-tr-sm'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}
