'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Mail,
  Phone,
  Star,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactModal } from './contact-modal';
import {
  deleteContactAction,
  setPrimaryContactAction,
} from '@/lib/actions/clients';
import type { Contact } from '@/lib/types/database';

interface Props {
  clientId: string;
  contacts: Contact[];
  canManage: boolean;
}

export function ContactsTab({ clientId, contacts, canManage }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function openCreateModal() {
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEditModal(contact: Contact) {
    setEditingContact(contact);
    setModalOpen(true);
  }

  async function handleSetPrimary(contactId: string) {
    setActionLoading(contactId);
    await setPrimaryContactAction(contactId, clientId);
    setActionLoading(null);
    router.refresh();
  }

  async function handleDelete(contactId: string, name: string) {
    if (!confirm(`¿Eliminar el contacto "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setActionLoading(contactId);
    await deleteContactAction(contactId, clientId);
    setActionLoading(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Contactos del cliente
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-3.5 h-3.5" />
            Nuevo contacto
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Sin contactos</div>
          <div className="text-sm text-muted-foreground mb-4">
            Agrega el primer contacto de este cliente.
          </div>
          {canManage && (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Crear primer contacto
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts
            .sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return a.first_name.localeCompare(b.first_name);
            })
            .map((contact) => (
              <div
                key={contact.id}
                className="border border-border rounded-lg bg-card p-4 flex items-start justify-between hover:border-photocan-amber/30 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-secondary border border-border grid place-items-center text-sm font-bold text-muted-foreground flex-shrink-0">
                    {contact.first_name.charAt(0)}
                    {contact.last_name.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </div>
                      {contact.is_primary && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-photocan-amber/15 text-photocan-amber-deep px-1.5 py-0.5 rounded">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Principal
                        </span>
                      )}
                    </div>

                    {contact.position && (
                      <div className="text-xs text-muted-foreground mb-2">
                        {contact.position}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </span>
                      {contact.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!contact.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(contact.id)}
                        disabled={actionLoading === contact.id}
                        title="Marcar como principal"
                        className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-photocan-amber transition-colors disabled:opacity-50"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(contact)}
                      title="Editar"
                      className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(
                          contact.id,
                          `${contact.first_name} ${contact.last_name}`
                        )
                      }
                      disabled={actionLoading === contact.id}
                      title="Eliminar"
                      className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {modalOpen && (
        <ContactModal
          clientId={clientId}
          contact={editingContact}
          onClose={() => {
            setModalOpen(false);
            setEditingContact(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingContact(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
