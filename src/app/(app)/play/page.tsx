"use client";

import { useState } from "react";
import { Swords, Clock, Zap } from "lucide-react";

const timeControls = [
  { id: "bullet", label: "Bullet", minutes: 1, increment: 0, icon: Zap, desc: "1 min" },
  { id: "blitz", label: "Blitz", minutes: 3, increment: 2, icon: Zap, desc: "3+2" },
  { id: "blitz2", label: "Blitz", minutes: 5, increment: 0, icon: Zap, desc: "5 min" },
  { id: "rapid", label: "Rapid", minutes: 10, increment: 0, icon: Clock, desc: "10 min" },
  { id: "rapid2", label: "Rapid", minutes: 15, increment: 10, icon: Clock, desc: "15+10" },
  { id: "classical", label: "Classical", minutes: 30, increment: 0, icon: Clock, desc: "30 min" },
];

export default function PlayPage() {
  const [selectedTC, setSelectedTC] = useState<string | null>(null);
  const [rated, setRated] = useState(true);
  const [searching, setSearching] = useState(false);

  const handleQuickMatch = () => {
    if (!selectedTC) return;
    setSearching(true);
    // Phase 2: Connect to game server WebSocket
    // For now, just show the searching state
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Play Chess</h1>
        <p className="text-sm text-ccb-muted mt-1">Choose your time control and find an opponent</p>
      </div>

      {/* Time control selection */}
      <div>
        <h3 className="text-sm font-medium text-ccb-muted mb-3">Time Control</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {timeControls.map((tc) => {
            const Icon = tc.icon;
            const isSelected = selectedTC === tc.id;
            return (
              <button
                key={tc.id}
                onClick={() => setSelectedTC(tc.id)}
                disabled={searching}
                className={`card flex items-center gap-3 transition-all ${
                  isSelected
                    ? "border-ccb-primary ring-2 ring-ccb-primary/30"
                    : "hover:border-ccb-border"
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? "text-ccb-primary" : "text-ccb-muted"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">{tc.desc}</div>
                  <div className="text-xs text-ccb-muted">{tc.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rated toggle */}
      <div className="flex items-center justify-between card">
        <div>
          <h3 className="font-medium">Ranked</h3>
          <p className="text-sm text-ccb-muted">Rated games affect your Glicko-2 rating</p>
        </div>
        <button
          onClick={() => setRated(!rated)}
          disabled={searching}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            rated ? "bg-ccb-primary" : "bg-ccb-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              rated ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Play button */}
      <button
        onClick={handleQuickMatch}
        disabled={!selectedTC || searching}
        className="btn-primary w-full text-base py-3"
      >
        {searching ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Finding opponent...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Swords className="w-5 h-5" />
            Quick Match
          </span>
        )}
      </button>

      {!selectedTC && !searching && (
        <p className="text-center text-sm text-ccb-muted">Select a time control to start</p>
      )}

      {searching && (
        <div className="card text-center">
          <div className="inline-block animate-pulse mb-3">
            <div className="w-16 h-16 rounded-full bg-ccb-primary/10 flex items-center justify-center mx-auto">
              <Swords className="w-8 h-8 text-ccb-primary" />
            </div>
          </div>
          <p className="text-sm text-ccb-muted">
            Game server coming soon. For now, the matchmaking UI is ready.
          </p>
          <button onClick={() => setSearching(false)} className="btn-ghost mt-3">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
