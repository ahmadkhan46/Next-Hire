"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { DollarSign, Zap, CheckCircle, Clock } from "lucide-react";

interface LLMStats {
  total_cost: number;
  total_tokens: number;
  total_requests: number;
  success_rate: number;
  avg_duration: number;
}

interface ModelStats {
  model: string;
  total_cost: number;
  total_requests: number;
}

export function LLMAnalyticsDashboard({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState<LLMStats | null>(null);
  const [byModel, setByModel] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/llm-analytics?days=30`)
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats);
        setByModel(data.byModel);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading analytics...</div>;
  }

  if (!stats) {
    return <div className="text-sm text-muted-foreground">No data available</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="text-2xl font-bold">${stats.total_cost.toFixed(2)}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-2xl font-bold">{stats.total_requests}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <CheckCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
              <div className="text-2xl font-bold">{(stats.success_rate * 100).toFixed(1)}%</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Avg Duration</div>
              <div className="text-2xl font-bold">{(stats.avg_duration / 1000).toFixed(1)}s</div>
            </div>
          </div>
        </Card>
      </div>

      {byModel.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Usage by Model</h3>
          <div className="space-y-2">
            {byModel.map((model) => (
              <div key={model.model} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{model.model}</div>
                  <div className="text-xs text-muted-foreground">
                    {model.total_requests} requests
                  </div>
                </div>
                <div className="text-sm font-semibold">${model.total_cost.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
