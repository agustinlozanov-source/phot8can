'use client';

import { useState } from 'react';
import { Package, Layers, Plus, Settings2 } from 'lucide-react';
import { InfoTab } from './info-tab';
import { CompositionTab } from './composition-tab';
import { ArchiveButton } from './archive-button';
import type { Service } from '@/lib/types/database';

type Tab = 'info' | 'composition';

interface CompositionItem {
  id: string;
  included_service_id: string;
  quantity: number;
  position: number;
  notes: string | null;
  included_service: {
    id: string;
    name: string;
    service_type: 'atomic' | 'package' | 'addon';
    default_price: number;
    currency: string;
    unit: string;
  };
}

interface AvailableService {
  id: string;
  name: string;
  service_type: 'atomic' | 'package' | 'addon';
  default_price: number;
  currency: string;
  unit: string;
}

interface Props {
  service: Service;
  composition: CompositionItem[];
  availableServices: AvailableService[];
  canManage: boolean;
  canDelete: boolean;
}

export function ServiceDetail({
  service,
  composition,
  availableServices,
  canManage,
  canDelete,
}: Props) {
  const isPackage = service.service_type === 'package';
  const [tab, setTab] = useState<Tab>(isPackage ? 'info' : 'info');

  return (
    <>
      {/* Header del servicio */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <ServiceTypeIcon type={service.service_type} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ServiceTypeBadge type={service.service_type} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">
              {service.name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-sm font-medium text-foreground">
                {formatPrice(service.default_price, service.currency)}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span className="font-mono text-xs">por {service.unit}</span>
              {service.sku && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="font-mono text-xs">SKU {service.sku}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            isActive={service.is_active}
            archived={!!service.archived_at}
          />
          {(canManage || canDelete) && (
            <ArchiveButton service={service} canDelete={canDelete} />
          )}
        </div>
      </div>

      {/* Aviso si está archivado */}
      {service.archived_at && (
        <div className="mb-6 rounded-md bg-muted/50 border border-border px-4 py-3 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Archivado el{' '}
          </span>
          <span className="text-muted-foreground">
            {new Date(service.archived_at).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          <TabButton
            active={tab === 'info'}
            onClick={() => setTab('info')}
            icon={<Settings2 className="w-3.5 h-3.5" />}
            label="Información"
          />
          {isPackage && (
            <TabButton
              active={tab === 'composition'}
              onClick={() => setTab('composition')}
              icon={<Layers className="w-3.5 h-3.5" />}
              label={`Composición (${composition.length})`}
            />
          )}
        </div>
      </div>

      {/* Contenido */}
      {tab === 'info' && <InfoTab service={service} canEdit={canManage} />}

      {tab === 'composition' && isPackage && (
        <CompositionTab
          packageServiceId={service.id}
          composition={composition}
          availableServices={availableServices}
          canManage={canManage}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-photocan-amber text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ServiceTypeIcon({
  type,
}: {
  type: 'atomic' | 'package' | 'addon';
}) {
  const config = {
    atomic: { Icon: Package, bg: 'bg-blue-500/10', text: 'text-blue-500' },
    package: {
      Icon: Layers,
      bg: 'bg-photocan-amber/15',
      text: 'text-photocan-amber-deep',
    },
    addon: { Icon: Plus, bg: 'bg-purple-500/10', text: 'text-purple-500' },
  };
  const { Icon, bg, text } = config[type];
  return (
    <div
      className={`w-14 h-14 rounded-lg grid place-items-center border border-border ${bg}`}
    >
      <Icon className={`w-6 h-6 ${text}`} />
    </div>
  );
}

function ServiceTypeBadge({
  type,
}: {
  type: 'atomic' | 'package' | 'addon';
}) {
  const labels = { atomic: 'Servicio', package: 'Paquete', addon: 'Addon' };
  const colors = {
    atomic: 'text-blue-500',
    package: 'text-photocan-amber-deep',
    addon: 'text-purple-500',
  };
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-widest ${colors[type]}`}
    >
      {labels[type]}
    </span>
  );
}

function StatusBadge({
  isActive,
  archived,
}: {
  isActive: boolean;
  archived: boolean;
}) {
  if (archived) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
        Archivado
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
      Inactivo
    </span>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}
