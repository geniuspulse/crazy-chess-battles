"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <p className="text-ccb-text/60">Something went wrong.</p>
      <p className="text-sm text-ccb-text/40 max-w-md text-center">{error.message}</p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  );
}
