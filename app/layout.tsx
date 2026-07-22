import type { Metadata } from "next";
import { Playfair_Display, Inter, Montserrat } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { CartProvider } from "@/lib/cart/CartContext";
import CartDrawer from "@/components/cart/CartDrawer";

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
      <body className={`${playfair.variable} ${inter.variable} ${montserrat.variable} antialiased`}>
        <CartProvider>
          <SmoothScroll>
            <Header />
            <main className="pt-24 md:pt-28">{children}</main>
            <Footer />
          </SmoothScroll>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
