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

function createNoiseBuffer(audioCtx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  return buffer;
}

/**
 * Tuned against Monkeytype's actual "nk creams" sample (fetched all 6
 * click4/*.wav variants and analyzed their real envelope + spectrum via
 * decodeAudioData — a prior guess based on mechanical-keyboard lore about
 * "deep bass thock" turned out wrong). The real samples are very short —
 * ~15-20ms of audible content, the rest of the file is silence — and peak
 * hard in the 1300-3500Hz band, with almost nothing below 600Hz or above
 * 5000Hz. "Creamy" here means rounded and free of harsh high-frequency
 * sizzle, not literally bass-heavy.
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

  // Master shape: cut sub-600Hz rumble and anything above ~4.6kHz — the
  // reference has neither.
  const master = audioCtx.createGain();
  master.gain.value = 1;
  const masterHighpass = audioCtx.createBiquadFilter();
  masterHighpass.type = "highpass";
  masterHighpass.frequency.value = 550;
  const masterLowpass = audioCtx.createBiquadFilter();
  masterLowpass.type = "lowpass";
  masterLowpass.frequency.value = 3600; // tighter still — less top-end sizzle, rounder
  master.connect(masterHighpass).connect(masterLowpass).connect(audioCtx.destination);

  // Main click body — bandpass-filtered noise, center biased toward the
  // lower half of the reference's ~1300-3500Hz range for a rounder, less
  // clicky presence.
  const durMain = 0.017;
  const main = audioCtx.createBufferSource();
  main.buffer = createNoiseBuffer(audioCtx, durMain);
  const bandMain = audioCtx.createBiquadFilter();
  bandMain.type = "bandpass";
  bandMain.frequency.value = 1050 + Math.random() * 1000;
  bandMain.Q.value = 1.0;
  const gainMain = audioCtx.createGain();
  gainMain.gain.setValueAtTime(0.75, t0);
  gainMain.gain.exponentialRampToValueAtTime(0.001, t0 + durMain);
  main.connect(bandMain).connect(gainMain).connect(master);
  main.start(t0);
  main.stop(t0 + durMain);

  // Secondary body layer, an octave or so lower — bumped up a bit more and
  // held a hair longer so there's more roundness underneath the click.
  const durBody = 0.022;
  const body = audioCtx.createBufferSource();
  body.buffer = createNoiseBuffer(audioCtx, durBody);
  const bandBody = audioCtx.createBiquadFilter();
  bandBody.type = "bandpass";
  bandBody.frequency.value = 650 + Math.random() * 280;
  bandBody.Q.value = 1.0;
  const gainBody = audioCtx.createGain();
  gainBody.gain.setValueAtTime(0.5, t0);
  gainBody.gain.exponentialRampToValueAtTime(0.001, t0 + durBody);
  body.connect(bandBody).connect(gainBody).connect(master);
  body.start(t0);
  body.stop(t0 + durBody);
}
