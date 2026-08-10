import Logo from "@/components/ui/Logo";
import OrbitRing from "@/components/home/OrbitRing";

/**
 * Template: fixed center logo with a continuously orbiting ring of product
 * category shortcuts. See OrbitRing.tsx for the rotation/hover mechanics.
 */
export default function OrbitHero() {
  return (
    <section className="relative flex h-100svh w-full items-center justify-center overflow-hidden bg-ink">
      <h1 className="sr-only">Atoreum MV: Lebelage launch in the Maldives</h1>

      <OrbitRing />

      <div className="relative z-10 flex flex-col items-center gap-3">
        <span className="block h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20">
          <Logo className="h-full w-full" />
        </span>
        <span className="flex flex-col items-center text-center">
          <span className="font-display text-2xl uppercase tracking-[0.2em] text-ivory sm:text-3xl md:text-4xl">
            Atoreum
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.35em] text-gold sm:text-xs">
            MV · Lebelage launch
          </span>
        </span>
      </div>
    </section>
  );
}
