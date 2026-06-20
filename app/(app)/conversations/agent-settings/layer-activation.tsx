'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, X, CheckCircle2, Power } from 'lucide-react';
import type { AgentSettings } from '@/lib/types/database';
import {
  updateAgentLayerAction,
  validateAgentReadinessAction,
} from '@/lib/actions/agent-settings';
import { Toggle, SaveBar } from './form-controls';

type Missing = { layer: string; label: string };

export function LayerActivation({
  settings,
  onSaved,
}: {
  settings: AgentSettings;
  onSaved: (data: Record<string, unknown>) => void;
}) {
  const [isEnabled, setIsEnabled] = useState(settings.is_enabled);
  const [autoRespond, setAutoRespond] = useState(settings.auto_respond);

  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<Missing[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: { is_enabled: boolean; auto_respond: boolean }) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateAgentLayerAction({
      layer: 'activation',
      data: next,
    });
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    onSaved(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    return true;
  }

  async function handleToggleEnabled(next: boolean) {
    setMissing(null);
    setError(null);

    if (!next) {
      // Desactivar: directo
      setIsEnabled(false);
      await persist({ is_enabled: false, auto_respond: autoRespond });
      return;
    }

    // Activar: validar primero
    setChecking(true);
    const result = await validateAgentReadinessAction();
    setChecking(false);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    if ('ready' in result && !result.ready) {
      setMissing(result.missing ?? []);
      return;
    }
    // Listo → confirmar
    setConfirming(true);
  }

  async function confirmActivation() {
    setConfirming(false);
    setIsEnabled(true);
    await persist({ is_enabled: true, auto_respond: autoRespond });
  }

  async function handleToggleAuto(next: boolean) {
    setAutoRespond(next);
    await persist({ is_enabled: isEnabled, auto_respond: next });
  }

  const stateLabel = !isEnabled
    ? 'Desactivado'
    : autoRespond
      ? 'Activo (respuesta automática)'
      : 'Modo asistente (solo sugerencias)';
  const stateTone = !isEnabled
    ? 'text-muted-foreground'
    : autoRespond
      ? 'text-green-500'
      : 'text-photocan-amber';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Estado actual */}
      <div className="border border-border rounded-lg p-5 bg-card">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Estado actual
        </div>
        <div className={`text-xl font-semibold flex items-center gap-2 ${stateTone}`}>
          <Power className="w-5 h-5" />
          {stateLabel}
        </div>
      </div>

      {/* Activación */}
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-4">
          <Toggle
            label="Activar el agente IA"
            description="Si está desactivado, el agente no responderá a ningún mensaje. Las conversaciones quedan en modo manual."
            checked={isEnabled}
            onChange={handleToggleEnabled}
            size="lg"
          />
          {checking && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verificando configuración...
            </div>
          )}
        </div>

        {isEnabled && (
          <div className="border border-border rounded-lg p-4">
            <Toggle
              label="Responder automáticamente"
              description="ON: el agente responde directamente al cliente sin esperar aprobación humana. OFF: el agente genera sugerencias que el equipo aprueba antes de enviar (modo asistente)."
              checked={autoRespond}
              onChange={handleToggleAuto}
              size="lg"
            />
          </div>
        )}
      </div>

      {/* Validación pre-activación fallida */}
      {missing && missing.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="font-medium text-sm mb-2 flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            Para activar el agente, completa primero:
          </div>
          <ul className="space-y-1">
            {missing.map((m, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <span>
                  <span className="text-muted-foreground">{m.layer}:</span>{' '}
                  {m.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SaveBar
        onSave={() => persist({ is_enabled: isEnabled, auto_respond: autoRespond })}
        saving={saving}
        saved={saved}
        error={error}
      />

      {/* Modal de confirmación */}
      {confirming && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setConfirming(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 grid place-items-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">¿Activar el agente IA?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {autoRespond
                    ? 'Empezará a responder automáticamente a los clientes que escriban.'
                    : 'Empezará a generar sugerencias de respuesta para que el equipo las apruebe.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={confirmActivation}
                className="h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90"
              >
                Activar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
