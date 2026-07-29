import type { Metadata } from "next";
import { Playfair_Display, Inter, Montserrat, Cinzel_Decorative, Marcellus_SC, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import PageTransition from "@/components/ui/PageTransition";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { CartProvider } from "@/lib/cart/CartContext";
import { SessionProvider } from "@/lib/auth/SessionContext";
import CartDrawer from "@/components/cart/CartDrawer";
import { ChromeVisibilityProvider } from "@/lib/layout/ChromeVisibility";

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

// Montserrat — reserved for the logo-origin scroll story's narrative copy.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

// Cinzel Decorative — ornate carved-serif display face, reserved for the
// origin story's opening title card only.
const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// JetBrains Mono — tabular figures for the admin dashboard's ledger/report
// typography (revenue, order counts, prices). Reserved for the dashboard;
// the storefront keeps its serif/sans pairing untouched.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Marcellus SC — upright small-caps display serif, the admin dashboard's
// heading font. Replaces font-display's italic (Playfair Display's cursive
// swashes read fine on the storefront's editorial copy but were hard to
// scan in a data-dense admin UI) everywhere the dashboard needs something
// that reads unambiguously as a heading.
const marcellusSC = Marcellus_SC({
  variable: "--font-admin-heading",
  subsets: ["latin"],
  weight: "400",
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
      <body className={`${playfair.variable} ${inter.variable} ${montserrat.variable} ${cinzelDecorative.variable} ${marcellusSC.variable} ${jetbrainsMono.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SessionProvider>
          <CartProvider>
            <ChromeVisibilityProvider>
              <SmoothScroll>
                <Header />
                <main id="main" className="pt-24 md:pt-28">
                  {/* The admin dashboard has its own nested, content-only
                      PageTransition (app/dashboard/layout.tsx) so its sidebar
                      never re-fades on internal navigation -- skip this outer
                      whole-subtree fade for dashboard-to-dashboard moves and
                      let the inner one handle it; still fade normally when
                      entering/leaving the dashboard section. */}
                  <PageTransition skipPrefixes={["/dashboard"]}>
                    {children}
                  </PageTransition>
                </main>
                <Footer />
              </SmoothScroll>
              <CartDrawer />
            </ChromeVisibilityProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
