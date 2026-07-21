import Logo from "@/components/ui/Logo";
import OrbitArcRing from "@/components/home/OrbitArcRing";

/**
 * Template: full-bleed hero with a large fixed center logo and a continuously
 * rotating ring of 15 category tiles, shown as a broad arc across the top —
 * matching the design reference (coveomusic.com), whose actual geometry we
 * measured directly: a clipped container (~80% of viewport height) with the
 * ring's diameter ~1.55× that height and a bottom-25% gradient fade, rather
 * than a full ring encircling the logo. See OrbitArcRing.tsx for the
 * rotation/hover mechanics.
 */
export default function ArcOrbitHero() {
  return (
    <section className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-ink">
      <h1 className="sr-only">Atoreum MV — Lebelage launch in the Maldives</h1>

      {/* Arc clip window — pinned to the top, height ~80% of the hero
          (matches the measured reference ratio). The ring's diameter (see
          OrbitArcRing) derives from this element's height via the inherited
          --arc-height custom property. */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden [--arc-height:calc(80svh)]"
        style={{ height: "var(--arc-height)" }}
      >
        <OrbitArcRing />

        {/* Top fade — the tallest/most-tilted tiles can reach this edge at
            their highest point in the rotation; fade instead of a hard
            visual crop. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[12%]"
          style={{ background: "linear-gradient(to top, transparent, var(--ink))" }}
        />

        {/* Bottom fade — items rotating into the lower arc blend into the
            hero's exact background color instead of hard-clipping. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[25%]"
          style={{ background: "linear-gradient(to bottom, transparent, var(--ink))" }}
        />
      </div>

      {/* Fixed center logo — never rotates, always on top, sitting in the
          open space the arc curves above rather than being encircled by it. */}
      <div className="relative z-30 flex flex-col items-center gap-4">
        <span
          className="block"
          style={{ width: "clamp(7.5rem, 18vw, 17.5rem)", height: "clamp(7.5rem, 18vw, 17.5rem)" }}
        >
          <Logo className="h-full w-full" />
        </span>
        <span className="flex flex-col items-center text-center">
          <span className="font-display text-2xl uppercase tracking-[0.2em] text-ivory sm:text-3xl md:text-4xl">
            Atoreum
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.35em] text-gold sm:text-xs">
            MV — Lebelage launch
          </span>
        </span>
      </div>
    </section>
  );
}
