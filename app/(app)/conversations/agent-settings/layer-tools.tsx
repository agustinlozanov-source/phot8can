'use client';

import { useState } from 'react';
import type { AgentSettings, AgentToolsEnabled } from '@/lib/types/database';
import { Toggle, SaveBar } from './form-controls';
import { useLayerSave } from './use-layer-save';

const TOOLS: { key: keyof AgentToolsEnabled; label: string; description: string }[] =
  [
    {
      key: 'view_strategy',
      label: 'Ver estrategia del cliente',
      description:
        'Permite al agente consultar la estrategia aprobada del cliente (objetivos, audiencia, pilares de contenido).',
    },
    {
      key: 'view_schedule',
      label: 'Ver cronograma activo',
      description: 'Permite consultar piezas próximas a publicar.',
    },
    {
      key: 'view_work_orders',
      label: 'Ver órdenes de trabajo',
      description: 'Permite ver piezas en producción y entregadas.',
    },
    {
      key: 'view_invoices',
      label: 'Ver estado de cobros',
      description: 'Permite consultar facturas pendientes y pagadas.',
    },
    {
      key: 'view_subscription',
      label: 'Ver suscripción',
      description: 'Permite consultar el plan y entregables del período.',
    },
  ];

const DEFAULT_TOOLS: AgentToolsEnabled = {
  view_strategy: true,
  view_schedule: true,
  view_work_orders: true,
  view_invoices: true,
  view_subscription: true,
};

export function LayerTools({
  settings,
  onSaved,
}: {
  settings: AgentSettings;
  onSaved: (data: Record<string, unknown>) => void;
}) {
  const initial =
    (settings.tools_enabled as AgentToolsEnabled | null) ?? DEFAULT_TOOLS;
  const [tools, setTools] = useState<AgentToolsEnabled>({
    ...DEFAULT_TOOLS,
    ...initial,
  });
  const [limit, setLimit] = useState(settings.context_message_history_limit ?? 20);

  const { save, saving, saved, error } = useLayerSave(onSaved);

  function handleSave() {
    save('tools', {
      tools_enabled: tools,
      context_message_history_limit: limit,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h3 className="text-sm font-semibold mb-3">Herramientas habilitadas</h3>
        <div className="space-y-3">
          {TOOLS.map((t) => (
            <div key={t.key} className="border border-border rounded-lg p-4">
              <Toggle
                label={t.label}
                description={t.description}
                checked={tools[t.key]}
                onChange={(v) => setTools((prev) => ({ ...prev, [t.key]: v }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">Contexto histórico</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Cuántos mensajes anteriores se le pasan al agente para que entienda el
          contexto de la conversación. Más = más contexto pero más tokens.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="flex-1 accent-photocan-amber"
          />
          <input
            type="number"
            min={5}
            max={100}
            value={limit}
            onChange={(e) =>
              setLimit(Math.max(5, Math.min(100, Number(e.target.value) || 5)))
            }
            className="w-20 h-9 px-3 rounded-md bg-secondary border border-border text-sm text-center font-mono outline-none focus:border-photocan-amber/50"
          />
          <span className="text-xs text-muted-foreground">mensajes</span>
        </div>
      </section>

      <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} />
    </div>
  );
}
