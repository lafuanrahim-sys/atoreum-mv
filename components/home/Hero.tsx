import CrosswordHero from "@/components/home/templates/CrosswordHero";
import OrbitHero from "@/components/home/templates/OrbitHero";
import ArcOrbitHero from "@/components/home/templates/ArcOrbitHero";

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
};

const ACTIVE_KEYS: (keyof typeof TEMPLATES)[] = ["crossword", "arcOrbit"];

export default function Hero() {
  return (
    <>
      {ACTIVE_KEYS.map((key) => {
        const Section = TEMPLATES[key];
        return <Section key={key} />;
      })}
    </>
  );
}
