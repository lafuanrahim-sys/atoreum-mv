import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import JsonLd from "@/components/seo/JsonLd";
import { storeSchema, websiteSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      {/* Who the shop is and where it trades. This is what gives the site a
          chance at "korean skincare maldives" rather than only at its own
          name -- a page of product cards says nothing about the business
          behind them. */}
      <JsonLd data={storeSchema()} />
      <JsonLd data={websiteSchema()} />
      <Hero />
    </>
  );
}
