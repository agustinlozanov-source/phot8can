'use client';

import { useState } from 'react';
import type { AgentSettings } from '@/lib/types/database';
import { TextAreaField, SaveBar } from './form-controls';
import { useLayerSave } from './use-layer-save';

export function LayerKnowledge({
  settings,
  onSaved,
}: {
  settings: AgentSettings;
  onSaved: (data: Record<string, unknown>) => void;
}) {
  const [description, setDescription] = useState(settings.org_description ?? '');
  const [services, setServices] = useState(settings.org_services_summary ?? '');
  const [process, setProcess] = useState(settings.org_process_summary ?? '');
  const [humanContact, setHumanContact] = useState(
    settings.human_contact_info ?? ''
  );

  const { save, saving, saved, error } = useLayerSave(onSaved);

  function handleSave() {
    save('knowledge', {
      org_description: description.trim() || null,
      org_services_summary: services.trim() || null,
      org_process_summary: process.trim() || null,
      human_contact_info: humanContact.trim() || null,
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <TextAreaField
        label="Sobre nosotros"
        required
        rows={5}
        value={description}
        onChange={setDescription}
        placeholder="Photocan es una agencia creativa especializada en contenido para redes sociales. Trabajamos con negocios locales y marcas medianas desde 2018, ofreciendo estrategia, producción y gestión de campañas."
      />
      <TextAreaField
        label="Servicios"
        rows={5}
        value={services}
        onChange={setServices}
        placeholder={`- Estrategia digital y plan de contenidos
- Producción de fotos, reels y video
- Diseño de piezas para redes
- Gestión de campañas publicitarias
- Manejo de comunidad y respuesta a clientes`}
      />
      <TextAreaField
        label="Cómo trabajamos"
        rows={5}
        value={process}
        onChange={setProcess}
        placeholder={`1. Reunión inicial y diagnóstico (1-2 días)
2. Generación de estrategia y aprobación (semana 1)
3. Cronograma del primer mes (semana 2)
4. Producción y entrega (mes 1 en adelante)
5. Revisiones mensuales con el cliente`}
      />
      <TextAreaField
        label="Cuándo contactar a un humano"
        rows={4}
        value={humanContact}
        onChange={setHumanContact}
        placeholder="Si el cliente tiene un problema urgente, una queja, o pide hablar con alguien del equipo, indica que se le contactará en horario laboral (L-V 9am-6pm hora CDMX). Si es fuera de horario, responder al siguiente día hábil."
      />
      <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} />
    </div>
  );
}
