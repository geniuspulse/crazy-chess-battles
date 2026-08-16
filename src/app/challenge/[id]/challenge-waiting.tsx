"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function ChallengeWaiting({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-ccb-primary/10 flex items-center justify-center mx-auto">
          <span className="w-3 h-3 rounded-full bg-ccb-primary animate-pulse" />
        </div>
        <h1 className="text-xl font-bold">Waiting for opponent...</h1>
        <p className="text-sm text-ccb-muted">Share this link with your friend:</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="input-field flex-1 text-xs"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button onClick={handleCopy} className="btn-secondary px-3">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {copied && <p className="text-xs text-green-400">Copied to clipboard!</p>}
        <p className="text-xs text-ccb-muted">
          The game will start automatically when they accept.
        </p>
      </div>
    </div>
  );
}
