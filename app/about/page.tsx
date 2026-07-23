import CrosswordHero from "@/components/home/templates/CrosswordHero";
import IntroSection from "@/components/home/IntroSection";
import CuratedSection from "@/components/home/CuratedSection";
import ExploreProducts from "@/components/home/ExploreProducts";
import CursorImageTrail from "@/components/home/CursorImageTrail";

export default function AboutPage() {
  return (
    <>
      <CrosswordHero />
      <IntroSection />
      <CuratedSection />
      <ExploreProducts />
      <CursorImageTrail />
    </>
  );
}
