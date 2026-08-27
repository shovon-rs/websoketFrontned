"use client";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioCtx) audioCtx = new AudioContextCtor();
  return audioCtx;
}

// Browsers suspend a freshly-created AudioContext until a user gesture occurs on the page.
// An incoming notification/call has no gesture behind it, so without this, the very first
// sound after page load would silently fail. Resume on the first interaction, once.
if (typeof window !== "undefined") {
  const unlock = () => {
    getContext()?.resume().catch(() => undefined);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function tone(ctx: AudioContext, startAt: number, freqFrom: number, freqTo: number, duration: number, peakGain: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freqFrom, startAt);
  if (freqTo !== freqFrom) osc.frequency.exponentialRampToValueAtTime(freqTo, startAt + duration * 0.6);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + Math.min(0.02, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** A short, pleasant two-note chime for an incoming notification or chat message. */
export function playNotificationChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    tone(ctx, now, 880, 1320, 0.14, 0.22);
    tone(ctx, now + 0.1, 1320, 1320, 0.16, 0.16);
  } catch {
    // audio unavailable/blocked — non-fatal
  }
}

/** A repeating ring (like a phone) — call the returned function to stop it. */
export function startRingtone(): () => void {
  const ctx = getContext();
  if (!ctx) return () => undefined;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function ringOnce() {
    if (stopped || !ctx) return;
    try {
      const now = ctx.currentTime;
      [0, 0.35].forEach((offset) => tone(ctx, now + offset, 740, 740, 0.28, 0.2));
    } catch {
      // audio unavailable/blocked — non-fatal
    }
    timer = setTimeout(ringOnce, 2000);
  }

  ringOnce();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
