# Atoreum MV

Korean beauty, curated for the Maldives. Next.js 16 (App Router) + TypeScript
+ Tailwind CSS v4, motion by GSAP + ScrollTrigger, smooth scroll by Lenis.

## Getting started locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The home page is `/`, the collection is
`/products`.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Structure

```
app/
  layout.tsx        Root layout — fonts, header/footer, smooth scroll
  page.tsx           Home page (Hero, IntroSection, CuratedSection)
  products/page.tsx  Collection page (banner + ProductGrid)
  globals.css        Design tokens (color, font vars) + base styles

components/
  layout/            Header, Footer
  home/              Hero, IntroSection, CuratedSection
  products/           ProductGrid, ProductCard
  ui/                 SmoothScroll (Lenis + GSAP ticker wiring)

hooks/
  useScrollReveal.ts  Shared fade/rise-on-scroll reveal (GSAP + ScrollTrigger)

lib/
  products.ts        Placeholder catalog — checkout-ready shape (price,
                      currency, inStock already split out)
  utils.ts            cn() class helper

public/
  videos/hero-atoreum.mp4   Brand film, used as the hero background
  images/products/           Empty — drop real product photography here
```

## Design system

Tokens live in `app/globals.css` under `@theme inline` (Tailwind v4's
CSS-first config):

| Token | Value | Use |
|---|---|---|
| `ink` | `#0b0b09` | Primary background |
| `charcoal` | `#17170f` | Secondary section background |
| `ivory` | `#f4efe4` | Primary text |
| `gold` | `#c9a15a` | Accent, CTAs, active states |
| `moss` | `#454b3e` | Product placeholder gradient |
| `sand` | `#a9906b` | Secondary labels/kickers |

Two fonts, both loaded via `next/font/google` in `app/layout.tsx`:

- **Playfair Display** (`--font-display` / `font-display` class) — all
  headlines
- **Inter** (`--font-sans`, default body font) — UI and body copy

> Fonts fetch from Google Fonts at build time. Your machine needs normal
> internet access for `npm run build` / `npm run dev` to resolve them —
> this only fails in network-locked sandboxes.

## What's not built yet

- Product images are typographic placeholders (see `ProductCard.tsx`) —
  swap in `next/image` once real photography exists at
  `public/images/products/`
- Checkout / cart / order panel — `lib/products.ts` and `ProductCard`
  were shaped deliberately so this slots in without a data model change
- Contact/concierge page (linked from footer, not yet built)

## Git workflow

```bash
git init
git add .
git commit -m "Foundation: home + products pages, design system, motion setup"
git checkout -b feature/next-thing
```
