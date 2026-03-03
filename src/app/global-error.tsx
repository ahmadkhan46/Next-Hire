"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center space-y-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Application Error
              </h2>
              <p className="text-slate-600">
                Something went wrong. Please try refreshing the page.
              </p>
            </div>

            <button
              onClick={reset}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
