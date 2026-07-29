import type { Metadata } from "next";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { Playfair_Display, Inter, Montserrat, Pinyon_Script, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import PageTransition from "@/components/ui/PageTransition";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MaintenancePage from "@/components/layout/MaintenancePage";
import { CartProvider } from "@/lib/cart/CartContext";
import { SessionProvider } from "@/lib/auth/SessionContext";
import CartDrawer from "@/components/cart/CartDrawer";
import { getSettings } from "@/lib/data/settings.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";

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

// Pinyon Script — formal copperplate calligraphy, reserved for the origin
// story's opening title card only.
const pinyonScript = Pinyon_Script({
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

export const metadata: Metadata = {
  title: "Atoreum MV — Lebelage launch in the Maldives",
  description:
    "Atoreum MV introduces Lebelage to the Maldives with premium Korean skincare curated for island life.",
};

// Shared, server-wide (not per-request) cache for the maintenance flag --
// avoids a Postgres round trip on every single page view while still
// picking up a toggle within a few seconds, no redeploy needed.
const getMaintenanceMode = unstable_cache(
  async () => (await getSettings()).maintenanceMode,
  ["maintenance-mode-flag"],
  { revalidate: 5 }
);

// Always reachable even while the site is offline: /login so an admin can
// sign in to turn it back off, /dashboard so that once signed in they're
// never blocked by the same switch they're trying to flip (it's already
// gated to admins only by middleware.ts).
const MAINTENANCE_EXEMPT_PREFIXES = ["/login", "/dashboard"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const exempt = MAINTENANCE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let showMaintenancePage = false;
  if (!exempt && (await getMaintenanceMode())) {
    const user = await getCurrentUser();
    showMaintenancePage = !user || !isAdminRole(user.role);
  }

  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable} ${montserrat.variable} ${pinyonScript.variable} ${jetbrainsMono.variable} antialiased`}>
        {showMaintenancePage ? (
          <MaintenancePage />
        ) : (
          <>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <SessionProvider>
              <CartProvider>
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
              </CartProvider>
            </SessionProvider>
          </>
        )}
      </body>
    </html>
  );
}
