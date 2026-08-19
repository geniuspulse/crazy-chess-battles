// Lightweight chess sound effects using Web Audio API — no asset files needed.

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15, delay = 0) {
  const ctx = getCtx();
  if (!ctx || !soundEnabled) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch {}
}

function playNoise(duration: number, volume = 0.1, delay = 0) {
  const ctx = getCtx();
  if (!ctx || !soundEnabled) return;
  try {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime + delay);
  } catch {}
}

type SoundType = "move" | "capture" | "check" | "castle" | "gameStart" | "gameEnd" | "promote";

export function playSound(type: SoundType) {
  switch (type) {
    case "move":
      // soft click — two quick descending tones
      playTone(440, 0.08, "sine", 0.12);
      playTone(330, 0.06, "sine", 0.08, 0.02);
      break;
    case "capture":
      // harder thud
      playTone(200, 0.12, "square", 0.1);
      playNoise(0.08, 0.06);
      break;
    case "castle":
      // double move sound
      playTone(440, 0.06, "sine", 0.1);
      playTone(440, 0.06, "sine", 0.1, 0.08);
      break;
    case "check":
      // alerting tone
      playTone(880, 0.1, "triangle", 0.12);
      playTone(1100, 0.1, "triangle", 0.1, 0.06);
      break;
    case "promote":
      // ascending fanfare
      playTone(523, 0.1, "sine", 0.1);
      playTone(659, 0.1, "sine", 0.1, 0.08);
      playTone(784, 0.15, "sine", 0.1, 0.16);
      break;
    case "gameStart":
      // short start chime
      playTone(523, 0.1, "sine", 0.1);
      playTone(659, 0.12, "sine", 0.1, 0.08);
      break;
    case "gameEnd":
      // game over descending
      playTone(440, 0.15, "sine", 0.12);
      playTone(330, 0.15, "sine", 0.12, 0.1);
      playTone(220, 0.25, "sine", 0.12, 0.2);
      break;
  }
}

// Detect move type from chess.js verbose move
export function detectMoveSound(move: { flags?: string; captured?: string | null; promotion?: string | null }): SoundType {
  if (move.flags?.includes("e") || move.captured) return "capture";
  if (move.flags?.includes("k") || move.flags?.includes("q")) return "castle";
  if (move.promotion) return "promote";
  return "move";
}
