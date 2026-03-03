"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="premium-block prestige-card rounded-3xl p-10 max-w-md text-center space-y-6">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 mx-auto">
          <AlertTriangle className="h-8 w-8" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-600">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="prestige-accent rounded-2xl">
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="rounded-2xl"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
