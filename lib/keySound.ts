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

/* ---------- Card flick (About → cursor image trail) ---------- */

let lastFlickAt = 0;

/**
 * The real recording (assets/audios/card-shuffling.mp3), decoded once.
 * How a card actually sounds (confirmed by waveform analysis + research):
 * friction FIRST, snap second — an airy whip of paper-on-paper sliding
 * leads into the snap, and during a shuffle the deck is never silent
 * between snaps. Each slice therefore starts ~40ms BEFORE its snap onset
 * to include the recording's own friction lead-in, and the fade-in is
 * stretched across that lead-in so every card blooms out of the slide
 * instead of appearing from silence.
 */
// `trim` levels each snap to matched loudness (the 1.51s snap is ~3x
// hotter than the rest in the raw recording) and `tone` gives the brighter
// snaps a lower ceiling, so no single card jumps out sharper or louder
// than its neighbours.
// Slices for the current recording (5.69s take). Trims are measured, not
// guessed: each slice was rendered offline through this exact playback
// chain and its output peak equalized to ~0.073, so all five cards leave
// the chain at the same loudness. This take runs quieter than the first
// one, hence trims above 1.
// Only the recording's three acoustically-matched single cards remain —
// the warm outlier (snap at 2.235, ~3.1kHz vs the family's ~4.4-5kHz) and
// the double-snap cluster (3.405+3.425, also the hottest event) were cut
// so every dealt card sounds like the same deck. No EQ anywhere: trims are
// measured against the raw, unfiltered slices.
const CARD_SLICES = [
  { start: 0.955, dur: 0.11, trim: 1.91 }, // snap at 0.995
  { start: 1.315, dur: 0.11, trim: 1.63 }, // snap at 1.355
  { start: 4.74, dur: 0.1, trim: 3.62 }, // snap at 4.78
] as const;

let shuffleBuffer: AudioBuffer | null = null;
let shuffleLoadState: "idle" | "loading" | "failed" = "idle";
let lastSlice = -1;

function ensureShuffleBuffer(audioCtx: AudioContext) {
  if (shuffleBuffer || shuffleLoadState === "loading" || shuffleLoadState === "failed") return;
  shuffleLoadState = "loading";
  // The version query must be bumped whenever the recording (and therefore
  // the slice table above) changes — the route allows an hour of caching,
  // and stale audio under new slice offsets plays the wrong material.
  fetch("/api/audio/card-shuffling?v=3")
    .then((res) => (res.ok && res.status === 200 ? res.arrayBuffer() : Promise.reject(new Error("fetch"))))
    .then((raw) => {
      // The route XOR-masks the payload so download managers don't sniff
      // it as audio (see app/api/audio/[name]/route.ts) — unmask in memory.
      const bytes = new Uint8Array(raw);
      for (let i = 0; i < bytes.length; i++) bytes[i] ^= 0x5a;
      return audioCtx.decodeAudioData(bytes.buffer);
    })
    .then((decoded) => {
      shuffleBuffer = decoded;
    })
    .catch(() => {
      // No fallback by design: the card sound is exclusively the provided
      // recording, so the trail stays silent if it can't load.
      shuffleLoadState = "failed";
    });
}

/**
 * One card dealt from the provided recording — and nothing else: no
 * synthesized layers, no fallback sounds. Only slices of the mp3 play,
 * shaped by EQ (which colors the recording but adds no sound of its own).
 *
 * `pan` (-1..1) places each card under the cursor. `speed` (0..1, cursor
 * velocity) drives the dealing tempo and each card's length: a slow hand
 * deals sparse full cards, a fast sweep deals rapid overlapping ones —
 * the overlap of real slices is what reads as continuous shuffling.
 */
export function playCardFlick(pan = 0, speed = 0.5) {
  const s = Math.min(1, Math.max(0, speed));

  // Every spawned card gets its own sound — pacing comes from the trail's
  // own distance gating, not from throttling here. The tiny guard only
  // stops two sounds landing in the same frame.
  const now = Date.now();
  if (now - lastFlickAt < 25) return;

  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  // Load lazily; until the recording is ready the trail is silent.
  ensureShuffleBuffer(audioCtx);
  if (!shuffleBuffer) return;

  lastFlickAt = now;
  const t0 = audioCtx.currentTime;

  let idx = Math.floor(Math.random() * CARD_SLICES.length);
  if (idx === lastSlice) idx = (idx + 1) % CARD_SLICES.length;
  lastSlice = idx;
  const slice = CARD_SLICES[idx];

  let out: AudioNode = audioCtx.destination;
  if (typeof audioCtx.createStereoPanner === "function") {
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = Math.max(-0.6, Math.min(0.6, pan));
    panner.connect(audioCtx.destination);
    out = panner;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = shuffleBuffer;
  // Detune kept very tight (±2%, no speed-based pitch shift) so every
  // card stays recognisably the same sound.
  src.playbackRate.value = 0.98 + Math.random() * 0.04;

  // The one piece of shaping: a little bass (+4dB below 320Hz) for the
  // cards' contact weight. Trims above are measured through this shelf.
  const bass = audioCtx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 320;
  bass.gain.value = 4;

  // The fade-in spans the slice's ~40ms friction lead-in, so the whip of
  // the slide swells into the snap the way it does physically. Fast
  // movement clips only the tail — never the lead-in. Fade-out 25ms.
  const playDur = Math.max(0.09, slice.dur * (1 - s * 0.25));
  const gain = audioCtx.createGain();
  const level = (0.5 + s * 0.4) * (0.85 + Math.random() * 0.3) * slice.trim;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + 0.035);
  gain.gain.setValueAtTime(level, t0 + Math.max(0.04, playDur - 0.025));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + playDur);

  src.connect(bass).connect(gain).connect(out);
  src.start(t0, slice.start, playDur + 0.02);
  src.stop(t0 + playDur + 0.02);
}

/* ---------- Journey travel sound (About → Korea-to-Malé chapter) ---------- */

let lastTickAt = 0;
const TICK_MIN_INTERVAL_MS = 80;

/**
 * The journey's odometer tick — a short, rounded sine blip whose pitch
 * climbs with progress (0..1), so scrolling the route sounds like a
 * counter winding up. Fires continuously while scroll input is arriving
 * (one tick per ~80ms cadence, from the very first scroll of the pin),
 * quiet, discrete, no tail. The caller gates on real wheel/touch input and
 * stops calling at 100%, so the sound spans exactly the user's gesture.
 */
export function updateTravelSound(progress: number, _deltaProgress: number) {
  const p = Math.min(1, Math.max(0, progress));

  const now = Date.now();
  if (now - lastTickAt < TICK_MIN_INTERVAL_MS) return;

  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  lastTickAt = now;
  const t0 = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 620 + p * 660; // rises as the shipment nears Malé

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2400;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);

  osc.connect(lowpass).connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.06);
}

/** Ticks are discrete and self-terminating — nothing continuous to cut. */
export function stopTravelSound() {
  // no-op by design
}

/**
 * Arrival: the original two-note chime — a gentle fourth (E5 → A5), soft
 * attack, quick fade.
 */
export function playLandingThud() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  const t0 = audioCtx.currentTime;
  [659.25, 880].forEach((freq, i) => {
    const start = t0 + i * 0.12;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}
