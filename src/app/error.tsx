"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl sm:text-6xl mb-4">♞</div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-ccb-muted mb-6">
          An unexpected error occurred. Try again or head back home.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary text-sm px-6 py-2.5 w-full sm:w-auto">
            Try Again
          </button>
          <Link href="/" className="btn-secondary text-sm px-6 py-2.5 w-full sm:w-auto">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
