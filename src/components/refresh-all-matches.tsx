'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function RefreshAllMatches({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculateAll: true }),
      });

      if (!res.ok) throw new Error('Failed to refresh matches');

      toast.success('All matches refreshed successfully!');
    } catch {
      toast.error('Failed to refresh matches');
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
      Refresh All Matches
    </Button>
  );
}
