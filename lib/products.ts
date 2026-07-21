export type Product = {
  id: string;
  name: string;
  brand: string;
  origin: string;
  category: "Skincare" | "Suncare" | "Makeup" | "Haircare" | "Fragrance";
  price: number;
  currency: "MVR" | "USD";
  description: string;
  image: string;
  inStock: boolean;
};

/**
 * Placeholder catalog for the foundation build.
 * Swap `image` paths for real product photography before launch —
 * they currently point at /public/images/products/ which is empty.
 * Shape is intentionally checkout-ready: price/currency/inStock are
 * already split out so the future cart + order panel can consume
 * this directly without a schema change.
 */
export const products: Product[] = [
  {
    id: "lebelage-first-launch-serum",
    name: "Lebelage Vita Serum",
    brand: "Lebelage",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 450,
    currency: "MVR",
    description:
      "A Lebelage debut serum selected by Atoreum MV for Maldives skin — brightening, hydrating, and weightless under tropical humidity.",
    image: "/images/products/lebelage-serum.jpg",
    inStock: true,
  },
  {
    id: "lebelage-sun-screen",
    name: "Lebelage Sun Shield SPF50+",
    brand: "Lebelage",
    origin: "Seoul, South Korea",
    category: "Suncare",
    price: 320,
    currency: "MVR",
    description:
      "A lightweight, no-white-cast SPF built for island days — designed to protect against strong sun and salt air.",
    image: "/images/products/lebelage-sunscreen.jpg",
    inStock: true,
  },
  {
    id: "lebelage-hydrating-mask",
    name: "Lebelage Aqua Reset Mask",
    brand: "Lebelage",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 285,
    currency: "MVR",
    description:
      "A calming overnight mask selected for Maldives evenings — restores moisture after long days by the sea.",
    image: "/images/products/lebelage-mask.jpg",
    inStock: true,
  },
];
