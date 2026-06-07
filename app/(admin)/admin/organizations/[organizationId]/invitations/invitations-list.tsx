'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cancelInvitation } from '@/lib/actions/invitations';
import { Copy, Check, X, Clock } from 'lucide-react';
import type { Invitation } from '@/lib/types/database';

interface InvitationsListProps {
  invitations: Invitation[];
}

export function InvitationsList({ invitations }: InvitationsListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLink(token: string, id: string) {
    const link = `${window.location.origin}/invitation/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleCancel(invitationId: string) {
    if (!confirm('¿Cancelar esta invitación? El link dejará de funcionar.')) {
      return;
    }
    await cancelInvitation(invitationId);
  }

  function daysUntilExpiry(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Invitado
            </th>
            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Correo
            </th>
            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Expira
            </th>
            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => {
            const days = daysUntilExpiry(inv.expires_at);
            return (
              <tr key={inv.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {inv.first_name} {inv.last_name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {inv.email}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-photocan-amber">
                    <Clock className="w-3 h-3" />
                    {days} {days === 1 ? 'día' : 'días'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyLink(inv.token, inv.id)}
                    >
                      {copiedId === inv.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar link
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(inv.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
