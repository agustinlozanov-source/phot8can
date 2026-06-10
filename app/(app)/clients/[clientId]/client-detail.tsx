'use client';

import { useState } from 'react';
import { Building2, Users, FileText } from 'lucide-react';
import { InfoTab } from './info-tab';
import { ContactsTab } from './contacts-tab';
import { ArchiveButton } from './archive-button';
import type { Client, Contact } from '@/lib/types/database';

type Tab = 'info' | 'contacts' | 'notes';

interface Props {
  client: Client;
  contacts: Contact[];
  users: Array<{ id: string; first_name: string; last_name: string }>;
  accountManager: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  canEdit: boolean;
  canManageContacts: boolean;
  canDelete: boolean;
}

export function ClientDetail({
  client,
  contacts,
  users,
  accountManager,
  canEdit,
  canManageContacts,
  canDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>('info');

  const primaryContact =
    contacts.find((c) => c.is_primary) || contacts[0] || null;

  return (
    <>
      {/* Header del cliente */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-lg grid place-items-center font-bold text-xl border border-border"
            style={{
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              client.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">
              {client.name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {client.legal_name && (
                <span className="font-mono text-xs">{client.legal_name}</span>
              )}
              {client.industry && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="font-mono text-xs">{client.industry}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            status={client.status}
            archived={!!client.archived_at}
          />
          {(canEdit || canDelete) && (
            <ArchiveButton
              client={client}
              canDelete={canDelete}
            />
          )}
        </div>
      </div>

      {/* Aviso si está archivado */}
      {client.archived_at && (
        <div className="mb-6 rounded-md bg-muted/50 border border-border px-4 py-3 text-sm flex items-center gap-2">
          <div className="text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Archivado el{' '}
            </span>
            {new Date(client.archived_at).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            {client.archive_reason && (
              <span> — {client.archive_reason}</span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          <TabButton
            active={tab === 'info'}
            onClick={() => setTab('info')}
            icon={<Building2 className="w-3.5 h-3.5" />}
            label="Información"
          />
          <TabButton
            active={tab === 'contacts'}
            onClick={() => setTab('contacts')}
            icon={<Users className="w-3.5 h-3.5" />}
            label={`Contactos (${contacts.length})`}
          />
          <TabButton
            active={tab === 'notes'}
            onClick={() => setTab('notes')}
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Notas"
          />
        </div>
      </div>

      {/* Contenido */}
      <div>
        {tab === 'info' && (
          <InfoTab
            client={client}
            users={users}
            accountManager={accountManager}
            primaryContact={primaryContact}
            canEdit={canEdit}
          />
        )}

        {tab === 'contacts' && (
          <ContactsTab
            clientId={client.id}
            contacts={contacts}
            canManage={canManageContacts}
          />
        )}

        {tab === 'notes' && (
          <NotesTab
            client={client}
            canEdit={canEdit}
          />
        )}
      </div>
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

function StatusBadge({
  status,
  archived,
}: {
  status: 'active' | 'paused' | 'churned';
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
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Activo
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber bg-photocan-amber/10 px-3 py-1.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-photocan-amber" />
        En pausa
      </span>
    );
  }
  return null;
}

function NotesTab({ client, canEdit }: { client: Client; canEdit: boolean }) {
  return (
    <div className="border border-border rounded-lg bg-card p-6">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Notas internas
      </div>
      {client.notes ? (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {client.notes}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          Sin notas registradas.{' '}
          {canEdit && 'Puedes agregar notas desde la pestaña Información.'}
        </div>
      )}
    </div>
  );
}
