"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface JobStatus {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade: number;
  correlationId?: string;
}

interface JobProgressProps {
  jobId: string;
  queueName: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export function JobProgress({ jobId, queueName, onComplete, onError }: JobProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/jobs-status?jobId=${jobId}&queue=${queueName}`);
        const data = await res.json();

        if (res.ok) {
          setStatus(data);

          if (data.state === 'completed') {
            clearInterval(interval);
            onComplete?.(data.returnvalue);
          } else if (data.state === 'failed') {
            clearInterval(interval);
            onError?.(data.failedReason || 'Job failed');
          }
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId, queueName, onComplete, onError]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm text-muted-foreground">Loading job status...</span>
        </div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-700">Job not found</span>
        </div>
      </Card>
    );
  }

  const getStateIcon = () => {
    switch (status.state) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'waiting':
      case 'delayed':
        return <Clock className="h-5 w-5 text-orange-600" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-gray-600" />;
    }
  };

  const getStateColor = () => {
    switch (status.state) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'active':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStateText = () => {
    switch (status.state) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'active':
        return 'Processing';
      case 'waiting':
        return 'Waiting';
      case 'delayed':
        return 'Delayed';
      default:
        return status.state;
    }
  };

  const failedRows = Array.isArray(status?.returnvalue?.failedRows)
    ? status?.returnvalue?.failedRows
    : [];

  return (
    <Card className={`p-4 ${getStateColor()}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStateIcon()}
            <div>
              <div className="font-medium">{getStateText()}</div>
              <div className="text-xs text-muted-foreground">Job ID: {status.id}</div>
            </div>
          </div>
          {status.attemptsMade > 0 && (
            <div className="text-xs text-muted-foreground">
              Attempt {status.attemptsMade}
            </div>
          )}
        </div>

        {status.correlationId ? (
          <div className="text-xs text-muted-foreground">Correlation ID: {status.correlationId}</div>
        ) : null}

        {status.state === 'active' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{status.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}

        {status.state === 'failed' && status.failedReason && (
          <div className="text-sm text-red-700">
            Error: {status.failedReason}
          </div>
        )}

        {status.state === 'completed' && status.returnvalue && (
          <div className="space-y-2">
            <div className="text-sm text-green-700">
              {status.returnvalue.imported} candidates imported successfully
              {status.returnvalue.failed > 0 && `, ${status.returnvalue.failed} failed`}
            </div>
            {failedRows.length > 0 && (
              <div className="rounded-md border border-red-200 bg-white p-3 text-sm">
                <div className="mb-2 font-medium text-red-700">Failed rows</div>
                <div className="space-y-1 text-xs text-red-700">
                  {failedRows.slice(0, 10).map((row: any) => (
                    <div key={`${row.rowIndex}-${row.errorCode}`}>
                      Row {row.rowIndex}
                      {row.name ? ` (${row.name})` : ''}: [{row.errorCode}] {row.error}
                      {row.retryCount > 0 ? ` (retries: ${row.retryCount})` : ''}
                    </div>
                  ))}
                  {failedRows.length > 10 && (
                    <div className="text-muted-foreground">
                      Showing 10 of {failedRows.length} failed rows.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
