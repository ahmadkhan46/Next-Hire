"use client";

import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RateLimitWarningProps {
  limit: number;
  remaining: number;
  reset: number;
  type: string;
}

export function RateLimitWarning({ limit, remaining, reset, type }: RateLimitWarningProps) {
  const percentage = (remaining / limit) * 100;
  const minutesUntilReset = Math.ceil((reset - Date.now()) / 60000);

  if (percentage > 20) return null; // Only show when < 20% remaining

  return (
    <Card className="border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-orange-900">Rate Limit Warning</h4>
          <p className="text-sm text-orange-700 mt-1">
            You have {remaining} of {limit} {type} requests remaining.
            Limit resets in {minutesUntilReset} minute{minutesUntilReset !== 1 ? 's' : ''}.
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-orange-200">
            <div
              className="h-full bg-orange-600 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RateLimitExceeded({ reset, type }: { reset: number; type: string }) {
  const minutesUntilReset = Math.ceil((reset - Date.now()) / 60000);

  return (
    <Card className="border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-900">Rate Limit Exceeded</h4>
          <p className="text-sm text-red-700 mt-1">
            You've reached the maximum number of {type} requests.
            Please try again in {minutesUntilReset} minute{minutesUntilReset !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    </Card>
  );
}
