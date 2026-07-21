import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import Header from "@/components/layout/Header";
import BarbaLoader from "@/components/layout/BarbaLoader";
import Footer from "@/components/layout/Footer";

// Display serif for headlines — editorial, luxury-catalogue register.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// Sans for UI/body copy — quiet, high-legibility counterpart to the serif.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atoreum MV — Lebelage launch in the Maldives",
  description:
    "Atoreum MV introduces Lebelage to the Maldives with premium Korean skincare curated for island life.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable} antialiased`}>
        <SmoothScroll>
          <Header />
          <BarbaLoader />
          <div data-barba="wrapper">
            <main data-barba="container" className="pt-24 md:pt-28">
              {children}
            </main>
          </div>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
