let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

const MIN_INTERVAL_MS = 35;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    ctx = new AudioContextClass();
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * A short synthesized "creamy" keyboard thock — soft muffled tap transient
 * plus a deep, round, pitch-dropping body. Cream/lubed-switch profile:
 * low click energy, dominant low-mid resonance, no sharp high-frequency clack.
 */
export function playKeySound() {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;

  const audioCtx = getContext();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  lastPlayedAt = now;
  const t0 = audioCtx.currentTime;

  // Master lowpass keeps the whole hit rounded/muffled — no bright edge.
  const master = audioCtx.createGain();
  master.gain.value = 1;
  const masterFilter = audioCtx.createBiquadFilter();
  masterFilter.type = "lowpass";
  masterFilter.frequency.value = 2200;
  master.connect(masterFilter).connect(audioCtx.destination);

  // Soft tap transient — filtered noise, quiet and brief, no sharp click.
  const noiseDuration = 0.018;
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * noiseDuration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 1500 + (Math.random() - 0.5) * 250;
  noiseFilter.Q.value = 0.6;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.13, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + noiseDuration);

  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start(t0);
  noise.stop(t0 + noiseDuration);

  // Deep, round "thock" body — pitch drops slightly for that marbly weight.
  const thockDuration = 0.11;
  const startFreq = 145 + (Math.random() - 0.5) * 20;
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.62, t0 + thockDuration);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.32, t0);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + thockDuration);

  osc.connect(oscGain).connect(master);
  osc.start(t0);
  osc.stop(t0 + thockDuration);

  // Sub-octave layer for roundness/warmth beneath the thock.
  const subDuration = 0.09;
  const sub = audioCtx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(startFreq * 0.5, t0);

  const subGain = audioCtx.createGain();
  subGain.gain.setValueAtTime(0.14, t0);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + subDuration);

  sub.connect(subGain).connect(master);
  sub.start(t0);
  sub.stop(t0 + subDuration);
}
