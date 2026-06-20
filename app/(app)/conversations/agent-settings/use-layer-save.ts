'use client';

import { useState } from 'react';
import { updateAgentLayerAction } from '@/lib/actions/agent-settings';

export type AgentLayer =
  | 'identity'
  | 'knowledge'
  | 'policies'
  | 'tools'
  | 'activation';

export function useLayerSave(
  onSaved: (data: Record<string, unknown>) => void
) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(layer: AgentLayer, data: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateAgentLayerAction({ layer, data });
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    onSaved(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    return true;
  }

  return { save, saving, saved, error };
}
