import CrosswordHero from "@/components/home/templates/CrosswordHero";
import VelocityMarquee from "@/components/about/VelocityMarquee";
import IntroSection from "@/components/home/IntroSection";
import JourneyChapter from "@/components/about/JourneyChapter";
import CuratedSection from "@/components/home/CuratedSection";
import ExploreProducts from "@/components/home/ExploreProducts";
import CursorImageTrail from "@/components/home/CursorImageTrail";

export default function AboutPage() {
  return (
    <>
      <CrosswordHero />
      <VelocityMarquee />
      <IntroSection />
      <JourneyChapter />
      <CuratedSection />
      <ExploreProducts />
      <CursorImageTrail />
    </>
  );
}
