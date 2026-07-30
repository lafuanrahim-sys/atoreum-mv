import Logo from "@/components/ui/Logo";
import OrbitArcRing from "@/components/home/OrbitArcRing";

/**
 * Template: full-height hero with the logo dead-center on screen and a
 * continuously rotating ring of 15 category cards, all at one shared radius,
 * orbiting fully around it. See OrbitArcRing.tsx for the rotation/hover
 * mechanics.
 */
export default function ArcOrbitHero() {
  return (
    <section className="relative flex h-100svh w-full items-center justify-center overflow-hidden bg-ink">
      <h1 className="sr-only">Atoreum MV — Lebelage launch in the Maldives</h1>

      <OrbitArcRing />

      {/* Fixed center logo — never rotates, always on top, dead-center. */}
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
