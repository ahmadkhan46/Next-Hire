'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculateAll: true }),
      });

      if (!res.ok) throw new Error(errorMessage);

      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
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
