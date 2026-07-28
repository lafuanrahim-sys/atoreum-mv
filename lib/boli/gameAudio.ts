import type { DiveOutcomeTier } from "./config";

/**
 * Procedural sound for Boli Dive — no audio assets needed, synthesized with
 * the Web Audio API. Just the reveal chime: a short tone, scaled up for a
 * rarer tier (more notes, brighter top end, a sub thump for Epic/Treasure).
 */

type AnyAudioContext = AudioContext;

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

let sharedCtx: AnyAudioContext | null = null;
function getSharedContext(): AnyAudioContext | null {
  const Ctx = getAudioContextClass();
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    try {
      sharedCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

const TIER_CHIME: Record<DiveOutcomeTier, { notes: number[]; noteGap: number; gain: number; decay: number; sub: boolean }> = {
  common: { notes: [880], noteGap: 0, gain: 0.05, decay: 0.4, sub: false },
  uncommon: { notes: [740, 1108], noteGap: 0.07, gain: 0.06, decay: 0.5, sub: false },
  rare: { notes: [659, 988, 1318], noteGap: 0.08, gain: 0.07, decay: 0.6, sub: false },
  epic: { notes: [523, 784, 1046, 1568], noteGap: 0.08, gain: 0.08, decay: 0.75, sub: true },
  treasure: { notes: [392, 587, 784, 1046, 1568, 2093], noteGap: 0.07, gain: 0.1, decay: 1.1, sub: true },
};

/** A short reveal chime, scaled up for a rarer tier — more notes, brighter top end, a sub thump for Epic/Treasure. */
export function playRevealChime(tier: DiveOutcomeTier) {
  const ctx = getSharedContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const spec = TIER_CHIME[tier];
  const now = ctx.currentTime;

  spec.notes.forEach((freq, i) => {
    const start = now + i * spec.noteGap;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(spec.gain, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + spec.decay + 0.05);
  });

  if (spec.sub) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 90;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }
}
