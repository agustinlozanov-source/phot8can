'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Search, Loader2, AlertCircle, UserPlus, Unlink } from 'lucide-react';
import {
  searchClientsForConversationAction,
  associateConversationToClientAction,
  dissociateConversationFromClientAction,
} from '@/lib/actions/conversations';

type ClientResult = {
  id: string;
  name: string;
  legal_name: string | null;
  phone: string | null;
};

interface Props {
  conversationId: string;
  hasClient: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function AssociateClientModal({
  conversationId,
  hasClient,
  onClose,
  onChanged,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const result = await searchClientsForConversationAction(query);
      setLoading(false);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if ('clients' in result) setResults(result.clients ?? []);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleAssociate(clientId: string) {
    setWorking(true);
    setError(null);
    const result = await associateConversationToClientAction({
      conversation_id: conversationId,
      client_id: clientId,
    });
    setWorking(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onChanged();
    onClose();
  }

  async function handleDissociate() {
    setWorking(true);
    setError(null);
    const result = await dissociateConversationFromClientAction(conversationId);
    setWorking(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !working && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold">Asociar cliente</h3>
          <button
            onClick={onClose}
            disabled={working}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente por nombre..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary border border-border text-sm outline-none focus:border-photocan-amber/50"
            />
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[120px]">
          {loading ? (
            <div className="p-6 grid place-items-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron clientes.
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => handleAssociate(c.id)}
                disabled={working}
                className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 disabled:opacity-50"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {c.phone || c.legal_name || 'Sin teléfono'}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-1.5 text-sm text-photocan-amber-deep hover:underline"
          >
            <UserPlus className="w-4 h-4" />
            Crear cliente nuevo
          </Link>
          {hasClient && (
            <button
              onClick={handleDissociate}
              disabled={working}
              className="inline-flex items-center gap-1.5 text-sm text-destructive hover:underline disabled:opacity-50"
            >
              <Unlink className="w-4 h-4" />
              Quitar asociación
            </button>
          )}
        </div>
      </div>
    </>
  );
}
