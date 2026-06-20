'use client';

import { useState } from 'react';
import type { AgentSettings } from '@/lib/types/database';
import { TextField, TextAreaField, Toggle, SaveBar } from './form-controls';
import { useLayerSave } from './use-layer-save';

export function LayerIdentity({
  settings,
  onSaved,
}: {
  settings: AgentSettings;
  onSaved: (data: Record<string, unknown>) => void;
}) {
  const [agentName, setAgentName] = useState(settings.agent_name ?? '');
  const [personality, setPersonality] = useState(
    settings.agent_personality ?? ''
  );
  const [register, setRegister] = useState(
    settings.language_register ?? 'español neutro'
  );
  const [contextual, setContextual] = useState(
    settings.enable_contextual_intelligence
  );
  const [hardLimits, setHardLimits] = useState(settings.hard_limits ?? '');

  const { save, saving, saved, error } = useLayerSave(onSaved);

  function handleSave() {
    save('identity', {
      agent_name: agentName.trim() || undefined,
      agent_personality: personality.trim() || null,
      language_register: register.trim() || null,
      enable_contextual_intelligence: contextual,
      hard_limits: hardLimits.trim() || null,
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <TextField
        label="Nombre del agente"
        hint="Cómo se presentará el agente"
        required
        value={agentName}
        onChange={setAgentName}
        placeholder="Sofía, Lía, Concierge..."
      />
      <TextAreaField
        label="Personalidad y tono"
        hint="Describe cómo debe sonar el agente al hablar"
        rows={3}
        value={personality}
        onChange={setPersonality}
        placeholder="Cálida, profesional, breve, empática..."
      />
      <TextField
        label="Idioma y registro"
        hint="Idioma específico y nivel de formalidad"
        value={register}
        onChange={setRegister}
        placeholder="español mexicano coloquial"
      />
      <div className="border border-border rounded-lg p-4">
        <Toggle
          label="Inteligencia contextual"
          description="Adapta el tono según el lenguaje del cliente. Si el cliente escribe formal, el agente responde formal; si escribe casual, casual."
          checked={contextual}
          onChange={setContextual}
        />
      </div>
      <TextAreaField
        label="Límites duros"
        hint="Lo que el agente NUNCA debe hacer o decir"
        rows={4}
        value={hardLimits}
        onChange={setHardLimits}
        placeholder={`Nunca prometer fechas de entrega sin verificar.
Nunca dar precios sin consultar con un humano.
Nunca hablar de temas políticos.`}
      />
      <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} />
    </div>
  );
}
