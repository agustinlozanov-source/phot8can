'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  ArrowLeft,
  FileText,
  MessageSquareText,
  User,
  BookOpen,
  Scale,
  Wrench,
  Power,
} from 'lucide-react';
import type { AgentSettings, AgentToolsEnabled } from '@/lib/types/database';
import { LayerIdentity } from './layer-identity';
import { LayerKnowledge } from './layer-knowledge';
import { LayerPolicies } from './layer-policies';
import { LayerTools } from './layer-tools';
import { LayerActivation } from './layer-activation';
import { PromptPreviewModal } from './prompt-preview-modal';
import { TestResponseModal } from './test-response-modal';

type TabKey = 'identity' | 'knowledge' | 'policies' | 'tools' | 'activation';
type Completeness = 'empty' | 'partial' | 'complete';

const TABS: { key: TabKey; num: number; label: string; icon: typeof User }[] = [
  { key: 'identity', num: 1, label: 'Identidad', icon: User },
  { key: 'knowledge', num: 2, label: 'Conocimiento', icon: BookOpen },
  { key: 'policies', num: 3, label: 'Políticas', icon: Scale },
  { key: 'tools', num: 4, label: 'Capacidades', icon: Wrench },
  { key: 'activation', num: 5, label: 'Activación', icon: Power },
];

function filledCount(values: (string | null | undefined)[]): number {
  return values.filter((v) => !!v && v.trim().length > 0).length;
}

function completenessFor(key: TabKey, s: AgentSettings): Completeness {
  if (key === 'identity') {
    const nameSet = !!s.agent_name?.trim() && s.agent_name !== 'Asistente';
    const n = (nameSet ? 1 : 0) + filledCount([s.agent_personality, s.hard_limits]);
    return n === 0 ? 'empty' : nameSet && n >= 2 ? 'complete' : 'partial';
  }
  if (key === 'knowledge') {
    const n = filledCount([
      s.org_description,
      s.org_services_summary,
      s.org_process_summary,
      s.human_contact_info,
    ]);
    return n === 0 ? 'empty' : n >= 3 && !!s.org_description?.trim() ? 'complete' : 'partial';
  }
  if (key === 'policies') {
    const n = filledCount([
      s.changes_policy,
      s.complaints_policy,
      s.escalation_triggers,
      s.upsell_policy,
      s.collections_policy,
    ]);
    return n === 0 ? 'empty' : n >= 3 && !!s.escalation_triggers?.trim() ? 'complete' : 'partial';
  }
  if (key === 'tools') return 'complete';
  // activation
  return s.is_enabled ? 'complete' : 'empty';
}

const DOT: Record<Completeness, string> = {
  empty: 'bg-muted-foreground/40',
  partial: 'bg-photocan-amber',
  complete: 'bg-green-500',
};

export function AgentSettingsView({
  initialSettings,
}: {
  initialSettings: AgentSettings;
}) {
  const [settings, setSettings] = useState<AgentSettings>(initialSettings);
  const [active, setActive] = useState<TabKey>('identity');
  const [showPreview, setShowPreview] = useState(false);
  const [showTest, setShowTest] = useState(false);

  function handleSaved(data: Record<string, unknown>) {
    setSettings((prev) => {
      const next = { ...prev, ...data } as AgentSettings;
      if ('tools_enabled' in data) {
        next.tools_enabled = data.tools_enabled as AgentToolsEnabled as never;
      }
      return next;
    });
  }

  const statusBadge = !settings.is_enabled
    ? { label: 'Agente desactivado', cls: 'bg-secondary text-muted-foreground' }
    : settings.auto_respond
      ? { label: 'Agente activo', cls: 'bg-green-500/10 text-green-500' }
      : {
          label: 'Solo sugerencias (modo asistente)',
          cls: 'bg-photocan-amber/10 text-photocan-amber-deep',
        };

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <Link
        href="/conversations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Conversaciones
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
            Conversaciones
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
            <Bot className="w-7 h-7 text-photocan-amber" />
            Entrenamiento del Agente IA
          </h1>
          <p className="text-muted-foreground text-sm">
            Configura cómo el agente atiende a los clientes
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge.cls}`}
          >
            {statusBadge.label}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary"
            >
              <FileText className="w-4 h-4" />
              Ver System Prompt
            </button>
            <button
              onClick={() => setShowTest(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary"
            >
              <MessageSquareText className="w-4 h-4" />
              Probar respuesta
            </button>
          </div>
        </div>
      </div>

      {/* Tabs verticales + contenido */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar de capas */}
        <nav className="md:w-56 md:flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:sticky md:top-6">
            {TABS.map((t) => {
              const status = completenessFor(t.key, settings);
              const Icon = t.icon;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full grid place-items-center text-[11px] font-mono ${
                      isActive
                        ? 'bg-photocan-amber text-black'
                        : 'bg-secondary border border-border'
                    }`}
                  >
                    {t.num}
                  </span>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{t.label}</span>
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT[status]}`}
                    title={status}
                  />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Panel de la capa activa */}
        <div className="flex-1 min-w-0">
          {active === 'identity' && (
            <LayerIdentity settings={settings} onSaved={handleSaved} />
          )}
          {active === 'knowledge' && (
            <LayerKnowledge settings={settings} onSaved={handleSaved} />
          )}
          {active === 'policies' && (
            <LayerPolicies settings={settings} onSaved={handleSaved} />
          )}
          {active === 'tools' && (
            <LayerTools settings={settings} onSaved={handleSaved} />
          )}
          {active === 'activation' && (
            <LayerActivation settings={settings} onSaved={handleSaved} />
          )}
        </div>
      </div>

      {showPreview && <PromptPreviewModal onClose={() => setShowPreview(false)} />}
      {showTest && <TestResponseModal onClose={() => setShowTest(false)} />}
    </div>
  );
}
