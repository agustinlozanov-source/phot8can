'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  PhoneOff,
} from 'lucide-react';
import type { InterviewTurn } from '@/lib/types/database';
import {
  appendTurnPublicAction,
} from '@/lib/actions/interviews';

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

type SessionState =
  | 'idle'           // Aún no se inicia
  | 'requesting'     // Pidiendo permiso de micrófono + token efímero
  | 'connecting'     // Estableciendo WebRTC
  | 'connected'      // Conversación activa
  | 'ending'         // Cerrando conexión
  | 'finished'       // Entrevista completada
  | 'error';         // Algo falló

export function VoiceInterview({
  token,
  clientName,
  interviewerName,
  orgName,
  orgColor,
  isResuming,
}: Props) {
  const [state, setState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<InterviewTurn[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Refs para WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Buffers para construir cada turno mientras llegan deltas
  const currentAssistantTextRef = useRef<string>('');
  const currentUserTextRef = useRef<string>('');

  // ============================================================
  // INICIAR SESIÓN
  // ============================================================

  async function startSession() {
    setState('requesting');
    setError(null);

    try {
      // 1. Pedir permiso de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // 2. Pedir token efímero al servidor
      const sessionResponse = await fetch('/api/interview/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al iniciar sesión');
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData.client_secret.value;

      setState('connecting');

      // 3. Crear peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // 4. Setup audio playback del modelo
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // 5. Agregar nuestro audio (mic) al peer connection
      pc.addTrack(stream.getAudioTracks()[0], stream);

      // 6. Setup data channel para eventos
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.addEventListener('open', () => {
        console.log('[voice] Data channel abierto');
      });

      dc.addEventListener('message', (event) => {
        handleServerEvent(JSON.parse(event.data));
      });

      // 7. Crear offer y enviarlo a OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime/calls',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Error al conectar con OpenAI');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      setState('connected');
      sessionStartTimeRef.current = Date.now();

      // Timer del duración
      timerIntervalRef.current = setInterval(() => {
        setSessionDuration(
          Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
        );
      }, 1000);
    } catch (err) {
      console.error('[voice] Error iniciando sesión:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar la entrevista. Verifica el permiso del micrófono.'
      );
      setState('error');
      cleanup();
    }
  }

  // ============================================================
  // MANEJAR EVENTOS DEL SERVIDOR (OpenAI Realtime)
  // ============================================================

  const handleServerEvent = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      switch (event.type) {
        // Mientras Lía habla, llegan deltas de texto
        case 'response.audio_transcript.delta': {
          const delta = (event.delta as string) || '';
          currentAssistantTextRef.current += delta;
          setIsAssistantSpeaking(true);
          break;
        }

        // Cuando Lía termina su turno
        case 'response.audio_transcript.done': {
          const fullText = currentAssistantTextRef.current;
          if (fullText.trim()) {
            const newTurn: InterviewTurn = {
              role: 'assistant',
              content: fullText.trim(),
              at: new Date().toISOString(),
            };
            setTranscript((prev) => [...prev, newTurn]);
            // Guardar en BD (fire and forget)
            appendTurnPublicAction({
              token,
              role: 'assistant',
              content: fullText.trim(),
            }).catch(console.error);
          }
          currentAssistantTextRef.current = '';
          setIsAssistantSpeaking(false);
          break;
        }

        // Mientras el cliente habla (Whisper transcribe en vivo)
        case 'conversation.item.input_audio_transcription.completed': {
          const transcriptText = (event.transcript as string) || '';
          if (transcriptText.trim()) {
            const newTurn: InterviewTurn = {
              role: 'user',
              content: transcriptText.trim(),
              at: new Date().toISOString(),
            };
            setTranscript((prev) => [...prev, newTurn]);
            appendTurnPublicAction({
              token,
              role: 'user',
              content: transcriptText.trim(),
            }).catch(console.error);
          }
          setIsUserSpeaking(false);
          break;
        }

        // Detección de voz: empezó a hablar
        case 'input_audio_buffer.speech_started': {
          setIsUserSpeaking(true);
          break;
        }

        // Detección de voz: dejó de hablar
        case 'input_audio_buffer.speech_stopped': {
          setIsUserSpeaking(false);
          break;
        }

        // Errores
        case 'error': {
          const errorMsg = (event.error as { message?: string })?.message || 'Error del servidor';
          console.error('[voice] Server error:', errorMsg);
          setError(`Error de OpenAI: ${errorMsg}`);
          break;
        }

        default:
          // Otros eventos no críticos
          break;
      }
    },
    [token]
  );

  // ============================================================
  // MUTE / UNMUTE
  // ============================================================

  function toggleMute() {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted; // si estaba muteado, ahora habilita
      setIsMuted(!isMuted);
    }
  }

  // ============================================================
  // TERMINAR SESIÓN
  // ============================================================

  function cleanup() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }

  async function endSession() {
    setState('ending');
    cleanup();

    try {
      const response = await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al terminar');
      }

      setState('finished');
    } catch (err) {
      console.error('[voice] Error finalizando:', err);
      setError(err instanceof Error ? err.message : 'Error al terminar');
      setState('error');
    }
  }

  // ============================================================
  // CLEANUP AL DESMONTAR
  // ============================================================

  useEffect(() => {
    return () => cleanup();
  }, []);

  // ============================================================
  // PANTALLAS POR ESTADO
  // ============================================================

  // Pantalla final
  if (state === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div
            className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6"
            style={{
              background: `${orgColor}20`,
              border: `2px solid ${orgColor}40`,
            }}
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
            En unos minutos {orgName} va a preparar tu estrategia.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de bienvenida
  if (state === 'idle' || state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div
            className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-6"
            style={{
              background: `${orgColor}15`,
              border: `2px solid ${orgColor}30`,
            }}
          >
            <Sparkles className="w-8 h-8" style={{ color: orgColor }} />
          </div>
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: orgColor }}
          >
            {orgName} · Entrevista por voz
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            Vamos a conocer {clientName}
          </h1>
          <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
            Soy {interviewerName}, la estratega de IA. Vamos a tener una
            conversación natural por voz sobre tu negocio.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Cuando hagas click en &ldquo;Empezar&rdquo;, te pediremos permiso para usar tu
            micrófono. Toma el tiempo que necesites, normalmente la entrevista
            dura 20-30 minutos.
          </p>

          {isResuming && (
            <div className="rounded-md bg-photocan-amber/10 border border-photocan-amber/30 p-3 text-xs flex items-start gap-2 mb-6 text-left">
              <AlertCircle
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: orgColor }}
              />
              <div>
                Ya hay una conversación previa con esta entrevista. Si
                continúas, se sumará a lo que ya conversamos.
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2 mb-6 text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={startSession}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md text-black font-medium hover:opacity-90 transition-opacity"
            style={{ background: orgColor }}
          >
            <Mic className="w-4 h-4" />
            {state === 'error' ? 'Intentar de nuevo' : 'Empezar entrevista'}
          </button>

          <p className="text-xs text-muted-foreground mt-6">
            Asegúrate de estar en un lugar con poco ruido y tener buena conexión.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla cargando
  if (state === 'requesting' || state === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Loader2
            className="w-12 h-12 animate-spin mx-auto mb-6"
            style={{ color: orgColor }}
          />
          <h2 className="text-xl font-medium mb-2">
            {state === 'requesting'
              ? 'Pidiendo permiso del micrófono...'
              : 'Conectando con la IA...'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Esto toma solo unos segundos.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla cerrando
  if (state === 'ending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Loader2
            className="w-12 h-12 animate-spin mx-auto mb-6"
            style={{ color: orgColor }}
          />
          <h2 className="text-xl font-medium mb-2">
            Terminando entrevista...
          </h2>
          <p className="text-sm text-muted-foreground">
            Estamos guardando todo lo que conversamos.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // CONNECTED - PANTALLA PRINCIPAL DE LA CONVERSACIÓN
  // ============================================================

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
              style={{
                background: `${orgColor}15`,
                border: `1px solid ${orgColor}30`,
              }}
            >
              <Sparkles className="w-4 h-4" style={{ color: orgColor }} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm">{interviewerName}</div>
              <div className="text-xs text-muted-foreground truncate">
                Conversación en vivo · {formatDuration(sessionDuration)}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={transcript.length < 4}
            className="text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Terminar entrevista
          </button>
        </div>
      </div>

      {/* Visualización central */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Esfera animada de audio */}
        <div className="relative mb-8">
          <div
            className={`w-48 h-48 rounded-full transition-all duration-300 ${
              isAssistantSpeaking
                ? 'scale-110'
                : isUserSpeaking
                  ? 'scale-105'
                  : 'scale-100'
            }`}
            style={{
              background: `radial-gradient(circle, ${orgColor}40 0%, ${orgColor}10 70%, transparent 100%)`,
            }}
          >
            <div
              className={`absolute inset-4 rounded-full transition-all duration-300 ${
                isAssistantSpeaking || isUserSpeaking ? 'scale-110' : 'scale-100'
              }`}
              style={{
                background: `radial-gradient(circle, ${orgColor}60 0%, ${orgColor}20 70%, transparent 100%)`,
              }}
            />
            <div
              className={`absolute inset-12 rounded-full grid place-items-center transition-all duration-300 ${
                isAssistantSpeaking
                  ? 'animate-pulse'
                  : ''
              }`}
              style={{
                background: orgColor,
              }}
            >
              <Sparkles className="w-12 h-12 text-black" />
            </div>
          </div>

          {/* Indicador de estado */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-mono uppercase tracking-wider px-3 py-1 rounded-full"
            style={{
              background: isAssistantSpeaking || isUserSpeaking ? orgColor : 'rgba(255,255,255,0.05)',
              color: isAssistantSpeaking || isUserSpeaking ? '#000' : 'inherit',
              border: `1px solid ${orgColor}40`,
            }}
          >
            {isAssistantSpeaking
              ? `${interviewerName} habla`
              : isUserSpeaking
                ? 'Te escucho'
                : 'Escuchando...'}
          </div>
        </div>

        {/* Último turno (para que el usuario sepa qué se dijo) */}
        {transcript.length > 0 && (
          <div className="max-w-xl w-full text-center mb-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Último turno
            </div>
            <p className="text-sm text-foreground/80 line-clamp-3">
              {transcript[transcript.length - 1].content}
            </p>
          </div>
        )}

        {/* Contador de turnos */}
        <div className="text-xs text-muted-foreground font-mono">
          {transcript.length} {transcript.length === 1 ? 'turno' : 'turnos'} ·{' '}
          {transcript.length < 4
            ? 'Continúa conversando para poder terminar'
            : 'Ya puedes terminar cuando quieras'}
        </div>
      </div>

      {/* Controles inferiores */}
      <div className="border-t border-border bg-card/30 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-center gap-3">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full grid place-items-center transition-colors ${
              isMuted
                ? 'bg-destructive/20 border-2 border-destructive text-destructive'
                : 'bg-secondary border-2 border-border hover:border-photocan-amber/40'
            }`}
            title={isMuted ? 'Activar micrófono' : 'Silenciar'}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={transcript.length < 4}
            className="w-14 h-14 rounded-full grid place-items-center bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Terminar entrevista"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal confirmar finalización */}
      {showFinishConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFinishConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">¿Terminar entrevista?</h3>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Vas a terminar tu conversación. {orgName} usará lo que
                conversamos para preparar tu estrategia.
              </p>
              <p className="text-sm text-muted-foreground">
                Si crees que todavía hay cosas importantes por contar,
                continúa hablando con {interviewerName}.
              </p>
            </div>
            <div className="p-6 border-t border-border flex gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary transition-colors"
              >
                Seguir conversando
              </button>
              <button
                onClick={endSession}
                className="flex-1 h-10 rounded-md text-black text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
                style={{ background: orgColor }}
              >
                Terminar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
