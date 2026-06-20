'use client';

import { useState } from 'react';
import type { AgentSettings } from '@/lib/types/database';
import { TextAreaField, SaveBar } from './form-controls';
import { useLayerSave } from './use-layer-save';

export function LayerPolicies({
  settings,
  onSaved,
}: {
  settings: AgentSettings;
  onSaved: (data: Record<string, unknown>) => void;
}) {
  const [changes, setChanges] = useState(settings.changes_policy ?? '');
  const [complaints, setComplaints] = useState(settings.complaints_policy ?? '');
  const [escalation, setEscalation] = useState(
    settings.escalation_triggers ?? ''
  );
  const [upsell, setUpsell] = useState(settings.upsell_policy ?? '');
  const [collections, setCollections] = useState(
    settings.collections_policy ?? ''
  );

  const { save, saving, saved, error } = useLayerSave(onSaved);

  function handleSave() {
    save('policies', {
      changes_policy: changes.trim() || null,
      complaints_policy: complaints.trim() || null,
      escalation_triggers: escalation.trim() || null,
      upsell_policy: upsell.trim() || null,
      collections_policy: collections.trim() || null,
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <TextAreaField
        label="Solicitudes de cambios"
        rows={4}
        value={changes}
        onChange={setChanges}
        placeholder="Cuando un cliente pide cambios a contenido, identificar la pieza específica y notificar al equipo. Los cambios menores se hacen en 24h, los mayores se evalúan con el Director."
      />
      <TextAreaField
        label="Manejo de quejas"
        rows={4}
        value={complaints}
        onChange={setComplaints}
        placeholder="Reconocer la queja con empatía, NO defender o excusar. Pedir más contexto, prometer escalar al equipo, dar tiempo estimado de respuesta (24h)."
      />
      <div className="border border-photocan-amber/30 bg-photocan-amber/5 rounded-lg p-4">
        <TextAreaField
          label="Cuándo escalar a un humano"
          required
          highlight
          rows={5}
          value={escalation}
          onChange={setEscalation}
          placeholder={`Escalar inmediatamente si:
- El cliente expresa frustración o enojo
- Habla de cancelación
- Tiene un problema urgente (en producción o publicado)
- Pide hablar con un humano directamente
- El tema requiere decisión estratégica
- El mensaje contiene términos legales o de pago disputados`}
        />
      </div>
      <TextAreaField
        label="Solicitudes de servicios extras"
        rows={4}
        value={upsell}
        onChange={setUpsell}
        placeholder="Si el cliente pide algo fuera de su plan, NO prometer nada. Indicar que se le enviará una cotización en 24h. Notificar al equipo comercial."
      />
      <TextAreaField
        label="Cobros y pagos pendientes"
        rows={4}
        value={collections}
        onChange={setCollections}
        placeholder="Si el cliente pregunta por un cobro, consultar view_invoices y dar la información. Si es un cobro vencido, NO presionar; indicar que el equipo lo contactará."
      />
      <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} />
    </div>
  );
}
