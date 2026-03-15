'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type RefreshAllMatchesProps = {
  orgId: string;
  label?: string;
  loadingLabel?: string;
  successMessage?: string;
  errorMessage?: string;
};

export function RefreshAllMatches({
  orgId,
  label = 'Refresh All Matches',
  loadingLabel = 'Refreshing...',
  successMessage = 'All matches refreshed successfully!',
  errorMessage = 'Failed to refresh matches',
}: RefreshAllMatchesProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculateAll: true }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' && data.error.trim().length > 0
            ? data.error
            : errorMessage
        );
      }

      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="rounded-2xl"
      onClick={handleRefresh}
      disabled={loading}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? loadingLabel : label}
    </Button>
  );
}
