import type { Metadata, Viewport } from "next";
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
import VisualViewportSync from "@/lib/layout/VisualViewportSync";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, STORE } from "@/lib/site";

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
  // Every relative URL in metadata — canonicals, Open Graph images — is
  // resolved against this. Without it Next emits relative og:image URLs, which
  // no social scraper can fetch, so shared links render with no picture.
  metadataBase: new URL(SITE_URL),
  title: {
    // Pages set only their own name; this appends the brand, so every tab and
    // every search result reads "<page> | Atoreum MV" without each page
    // repeating it. `default` covers the pages that set no title at all.
    default: "Atoreum MV | Korean Skincare in the Maldives",
    template: "%s | Atoreum MV",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // What someone would actually type into Google. Meta keywords are ignored
  // for ranking; these are here because some non-Google crawlers and internal
  // site searches still read them, and they cost nothing.
  keywords: [
    "Korean skincare Maldives",
    "Lebelage Maldives",
    "skincare Malé",
    "K-beauty Maldives",
    "serum Maldives",
    "sunscreen Maldives",
    "Atoreum MV",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: STORE.legalName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: "Atoreum MV | Korean Skincare in the Maldives",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    // summary_large_image, not summary: the preview is the whole reason a
    // link gets tapped when it's pasted into a WhatsApp or Instagram DM,
    // which is how most of this shop's traffic will actually arrive.
    card: "summary_large_image",
    title: "Atoreum MV | Korean Skincare in the Maldives",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Defaults cap the text snippet and forbid large image previews, which
      // makes a product listing look thin next to competitors.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "shopping",
  // Adding a Search Console property is a one-line change here once the
  // verification token exists; left unset rather than faked.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

// minimumScale pins the page at 100% or tighter -- can't pinch out past the
// normal view, which is what was actually asked for. maximumScale stays
// generous (5x) and userScalable stays true so zooming IN still works --
// unlike blocking zoom outright, this doesn't fail WCAG 1.4.4/1.4.10, which
// are about being able to magnify content, not about being able to shrink it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
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
        <VisualViewportSync />
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
