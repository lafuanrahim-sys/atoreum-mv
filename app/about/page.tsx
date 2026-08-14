import type { Metadata } from "next";
import CrosswordHero from "@/components/home/templates/CrosswordHero";
import VelocityMarquee from "@/components/about/VelocityMarquee";
import IntroSection from "@/components/home/IntroSection";
import JourneyChapter from "@/components/about/JourneyChapter";
import ExploreProducts from "@/components/home/ExploreProducts";
import CursorImageTrail from "@/components/home/CursorImageTrail";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Why Atoreum MV brought Lebelage to the Maldives: Korean skincare chosen for island heat, humidity and sun, sourced from Seoul and delivered in Malé.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <CrosswordHero />
      <VelocityMarquee />
      <IntroSection />
      <JourneyChapter />
      <ExploreProducts />
      <CursorImageTrail />
    </>
  );
}
