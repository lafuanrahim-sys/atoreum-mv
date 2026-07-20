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
    id: "beauty-of-joseon-relief-sun",
    name: "Relief Sun: Rice + Probiotics SPF50+",
    brand: "Beauty of Joseon",
    origin: "Seoul, South Korea",
    category: "Suncare",
    price: 285,
    currency: "MVR",
    description:
      "A weightless, no-white-cast mineral-hybrid sunscreen built for humidity — formulated for exactly the climate Malé lives in.",
    image: "/images/products/relief-sun.jpg",
    inStock: true,
  },
  {
    id: "sulwhasoo-first-care-serum",
    name: "First Care Activating Serum VI",
    brand: "Sulwhasoo",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 1450,
    currency: "MVR",
    description:
      "The ritual first step of Korean skincare — a ginseng-rooted essence that preps skin to absorb everything that follows.",
    image: "/images/products/first-care-serum.jpg",
    inStock: true,
  },
  {
    id: "cosrx-snail-mucin",
    name: "Advanced Snail 96 Mucin Power Essence",
    brand: "COSRX",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 310,
    currency: "MVR",
    description:
      "Cult-favourite hydration and barrier repair, distilled to one ingredient doing all the work.",
    image: "/images/products/snail-mucin.jpg",
    inStock: true,
  },
  {
    id: "hera-black-cushion",
    name: "Black Cushion SPF34",
    brand: "HERA",
    origin: "Seoul, South Korea",
    category: "Makeup",
    price: 720,
    currency: "MVR",
    description:
      "A second-skin cushion foundation engineered to hold through heat and humidity without breaking.",
    image: "/images/products/black-cushion.jpg",
    inStock: true,
  },
  {
    id: "amorepacific-time-response",
    name: "Time Response Skin Reserve Cream",
    brand: "AMOREPACIFIC",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 3200,
    currency: "MVR",
    description:
      "Rare green tea seed extraction in a single-batch cream — the house's most quietly prestigious formula.",
    image: "/images/products/time-response.jpg",
    inStock: false,
  },
  {
    id: "primera-miel-lip-sleeping-mask",
    name: "Miel Lip Sleeping Mask",
    brand: "Primera",
    origin: "Seoul, South Korea",
    category: "Skincare",
    price: 195,
    currency: "MVR",
    description:
      "An overnight honey-based mask for lips that spend the day in salt air and sun.",
    image: "/images/products/miel-lip-mask.jpg",
    inStock: true,
  },
  {
    id: "tamburins-perfume-oil",
    name: "Perfume Oil — Musk Edition",
    brand: "TAMBURINS",
    origin: "Seoul, South Korea",
    category: "Fragrance",
    price: 890,
    currency: "MVR",
    description:
      "The scent-house behind Gentle Monster's fragrance line — warm, skin-close, unmistakably modern.",
    image: "/images/products/tamburins-oil.jpg",
    inStock: true,
  },
  {
    id: "ryo-hair-loss-shampoo",
    name: "Jayangyunmo Hair Loss Care Shampoo",
    brand: "RYO",
    origin: "Seoul, South Korea",
    category: "Haircare",
    price: 240,
    currency: "MVR",
    description:
      "A ginseng and herbal-root formula built to counter what saltwater and sun do to hair over time.",
    image: "/images/products/ryo-shampoo.jpg",
    inStock: true,
  },
];
