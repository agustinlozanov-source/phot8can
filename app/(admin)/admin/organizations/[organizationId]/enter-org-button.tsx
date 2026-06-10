'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enterOrganization } from '@/lib/actions/impersonation';

export function EnterOrgButton({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnter() {
    setError(null);
    setIsLoading(true);

    const result = await enterOrganization(organizationId);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    // Redirigir al dashboard de la organización
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleEnter} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            Entrar como {organizationName}
          </>
        )}
      </Button>
      {error && (
        <div className="text-xs text-destructive font-mono">{error}</div>
      )}
    </div>
  );
}
