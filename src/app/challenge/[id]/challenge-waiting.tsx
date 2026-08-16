"use client";

export default function ChallengeWaiting({ url }: { url: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold">Waiting for opponent...</h1>
        <p className="text-sm text-ccb-muted">Share this link with your friend:</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="input-field flex-1 text-xs"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
        <p className="text-xs text-ccb-muted">
          The game will start automatically when they accept.
        </p>
      </div>
    </div>
  );
}
