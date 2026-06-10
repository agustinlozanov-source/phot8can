'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, LogOut, Loader2 } from 'lucide-react';
import { exitOrganization } from '@/lib/actions/impersonation';

export function ImpersonationBanner({
  organizationName,
}: {
  organizationName: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleExit() {
    setIsLoading(true);
    await exitOrganization();
    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="bg-photocan-amber/15 border-b border-photocan-amber/30 px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-sm">
        <div className="w-6 h-6 rounded bg-photocan-amber/20 border border-photocan-amber/40 grid place-items-center">
          <Eye className="w-3 h-3 text-photocan-amber-deep" />
        </div>
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-photocan-amber-deep">
            Modo impersonation ·{' '}
          </span>
          <span className="font-medium text-foreground">
            Viendo como {organizationName}
          </span>
        </div>
      </div>

      <button
        onClick={handleExit}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-photocan-amber-deep hover:text-photocan-amber-deep/80 transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saliendo...
          </>
        ) : (
          <>
            <LogOut className="w-3.5 h-3.5" />
            Salir del modo organización
          </>
        )}
      </button>
    </div>
  );
}
