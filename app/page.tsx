import Hero from "@/components/home/Hero";
import IntroSection from "@/components/home/IntroSection";
import FeaturedCollection from "@/components/home/FeaturedCollection";
import CuratedSection from "@/components/home/CuratedSection";
import ExploreProducts from "@/components/home/ExploreProducts";

export default function HomePage() {
  return (
    <>
      <Hero />
      <IntroSection />
      <FeaturedCollection />
      <CuratedSection />
      <ExploreProducts />
    </>
  );
}
