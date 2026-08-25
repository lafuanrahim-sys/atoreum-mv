import Link from "next/link";
import { DIVE_PAYOUT_TABLE, STREAK_CHEST_BOLI, BOLI_TO_MVR } from "@/lib/boli/config";

/**
 * The nudge toward Sangu Dive.
 *
 * The game existed and nobody knew: it lives behind the Sangu tab, two clicks
 * from anywhere anyone lands, and nothing on the site ever mentioned it. A
 * daily free reward customers never discover is worse than not having one --
 * it cost the work and returns nothing.
 *
 * Written to look like a game rather than a system notice. The first version
 * was a bordered box in the same greys as everything around it, which read as
 * something to dismiss. This one gets its own water, its own light, and the
 * top prize as the thing your eye lands on.
 *
 * Every figure comes from the payout table, so changing the prizes changes the
 * banner instead of quietly making it a lie.
 */

const TOP_PRIZE_MVR = Math.round(DIVE_PAYOUT_TABLE.treasure.boli * BOLI_TO_MVR);
const TYPICAL_MVR = (DIVE_PAYOUT_TABLE.common.boli * BOLI_TO_MVR).toFixed(2);
const STREAK_MVR = Math.round(STREAK_CHEST_BOLI * BOLI_TO_MVR);

/** Bubbles rising through the card. Decorative, and hidden from the reader. */
function Bubbles() {
  const bubbles = [
    { left: "12%", size: 6, delay: "0s", duration: "7s" },
    { left: "26%", size: 3, delay: "1.4s", duration: "9s" },
    { left: "41%", size: 8, delay: "2.6s", duration: "8s" },
    { left: "58%", size: 4, delay: "0.7s", duration: "10s" },
    { left: "72%", size: 5, delay: "3.2s", duration: "7.5s" },
    { left: "86%", size: 3, delay: "1.9s", duration: "9.5s" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="dive-bubble absolute rounded-full bg-white/25"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function DivePrompt({
  playedToday,
  wonToday,
  streakDay,
}: {
  playedToday: boolean;
  /** Sangu won on today's dive, when they have already played. */
  wonToday?: number | null;
  /** How many days running, for the streak line. */
  streakDay?: number | null;
}) {
  /**
   * Already played: quiet, and warm rather than loud.
   *
   * A card shouting "PLAY NOW" at someone who played an hour ago is the
   * fastest way to teach them the banner is not worth reading. This one
   * congratulates and gets out of the way.
   */
  if (playedToday) {
    return (
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.10] to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              <path d="M4 10.5l4 4 8-8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-sm text-ivory">
              {typeof wonToday === "number" && wonToday > 0
                ? `You won ${wonToday.toLocaleString("en-US")} Sangu today.`
                : "You have dived today."}
              {typeof streakDay === "number" && streakDay > 1 && (
                <span className="ml-1.5 rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-gold">
                  {streakDay} day streak
                </span>
              )}
            </p>
            <p className="mt-1 text-[12px] text-ivory-dim">Your next dive opens tomorrow.</p>
          </div>
        </div>
        <Link
          href="/account?tab=boli&boliView=dive"
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300 underline decoration-emerald-500/30 underline-offset-4 transition-colors hover:decoration-emerald-300"
        >
          See your dive
        </Link>
      </div>
    );
  }

  return (
    <div className="dive-card relative mt-8 overflow-hidden rounded-2xl border border-gold/30">
      {/* Water: a deep teal that lifts toward gold where the treasure is. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,#0b3b3c_0%,#0e2f33_45%,#1b2b26_100%)]"
      />
      {/* The glow behind the prize, so the eye goes there first. */}
      <div
        aria-hidden="true"
        className="absolute -right-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(233,186,122,0.30),transparent_65%)] blur-xl"
      />
      <Bubbles />

      <div className="relative flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#7fd4c1]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7fd4c1] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7fd4c1]" />
            </span>
            Free today
          </p>

          <h3 className="mt-3 font-display text-2xl leading-tight text-white sm:text-3xl">
            Dive for treasure
          </h3>

          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/75">
            Pick three shells, keep whatever you find. Free, once a day. Most dives pay around
            MVR {TYPICAL_MVR}, and seven days running adds MVR {STREAK_MVR} from the streak chest.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
          {/* The number worth crossing the page for. */}
          <div className="sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0cd9a]">Top prize</p>
            <p className="font-display text-4xl leading-none text-gold sm:text-5xl">
              MVR {TOP_PRIZE_MVR}
            </p>
          </div>

          <Link
            href="/account?tab=boli&boliView=dive"
            className="group flex min-h-12 items-center gap-2.5 rounded-full bg-[#e9ba7a] px-8 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0b2b2c] shadow-[0_6px_20px_-6px_rgba(233,186,122,0.6)] transition-transform hover:scale-[1.03] hover:bg-[#f2c98d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Dive now
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
              <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
