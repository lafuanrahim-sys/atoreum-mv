import CrosswordHero from "@/components/home/templates/CrosswordHero";
import OrbitHero from "@/components/home/templates/OrbitHero";
import ArcOrbitHero from "@/components/home/templates/ArcOrbitHero";
import CoverflowHero from "@/components/home/templates/CoverflowHero";
import LogoOriginSequence from "@/components/home/LogoOriginSequence";

/**
 * Switchboard for home page hero designs. Each design variant lives as its
 * own file in `components/home/templates/`, fully self-contained, so old
 * ones stay intact while new ones are built. ACTIVE_KEYS renders in order —
 * add/remove/reorder keys to stack templates or preview just one.
 */
const TEMPLATES = {
  crossword: CrosswordHero,
  orbit: OrbitHero,
  arcOrbit: ArcOrbitHero,
  coverflow: CoverflowHero,
};

const ACTIVE_KEYS: (keyof typeof TEMPLATES)[] = [];

export default function Hero() {
  return (
    <>
      <LogoOriginSequence />
      {ACTIVE_KEYS.map((key) => {
        const Section = TEMPLATES[key];
        return <Section key={key} />;
      })}
    </>
  );
}
