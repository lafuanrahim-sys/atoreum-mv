# Atoreum MV Master Blueprint

This document is the source of truth for the Atoreum MV website. It defines the brand, visual direction, motion language, page architecture, checkout flow, future roadmap, technical standards, and implementation rules.

## 1. Brand Identity

### Brand Name

Atoreum MV

### Tagline

Korean Beauty • Maldivian Soul

### Positioning

Atoreum MV is a premium Korean skincare distributor in the Maldives. The website should feel curated, intentional, and refined, positioning Atoreum MV as a trusted bridge between high-quality Korean skincare and the Maldivian beauty market.

The brand is not a mass marketplace. It is a selective skincare destination built around trust, quality, quiet luxury, and careful sourcing.

### Brand Personality

- Minimal
- Refined
- Calm
- Luxurious
- Intentional
- Sophisticated
- Clean
- Editorial
- Trustworthy
- Quietly premium

### Visual Inspiration

The visual direction should take inspiration from:

- Apple: restraint, precision, generous negative space, smooth transitions.
- Aesop: editorial product storytelling, refined typography, understated luxury.
- Gentle Monster: cinematic brand reveals, modern pacing, dramatic restraint.
- Korean skincare: clarity, softness, glow, hydration, purity, clinical elegance.
- Maldivian elegance: sea-glass tones, pearlescent whites, warm sunlight, soft sand, island calm.

The final website should not copy any of these references directly. They are directional anchors for quality, atmosphere, and restraint.

## 2. Visual System

### Color Palette

The palette should be inspired by the uploaded Atoreum logo and the Maldivian environment. It should feel soft, premium, natural, and clean.

#### Core Colors

- Sea-glass green: primary brand accent. Used for highlights, primary buttons, active states, subtle gradients, and brand moments.
- Pearl white: main page background and product canvas. Used for clean premium space.
- Warm ivory: secondary background tone for editorial sections and softer content areas.
- Blush pink: delicate accent for beauty, hydration, and subtle warmth. Used sparingly.
- Deep slate green: primary text color, footer background, high-contrast buttons, and serious brand moments.
- Soft sand: grounding neutral for dividers, product backgrounds, checkout surfaces, and low-contrast panels.

#### Suggested Token Direction

- `--color-sea-glass`: muted green with a polished skincare feel.
- `--color-pearl`: near-white with a soft warm undertone.
- `--color-ivory`: warm off-white for section contrast.
- `--color-blush`: pale pink accent, never dominant.
- `--color-slate-green`: deep green-black for text and premium contrast.
- `--color-sand`: soft beige-neutral for borders and secondary surfaces.

### Typography Direction

Typography should feel premium, quiet, and editorial.

#### Primary Typography

Use a clean modern sans-serif for core UI, navigation, product information, forms, and checkout. The type should be highly legible, with crisp spacing and restrained weights.

Recommended direction:

- Modern grotesk or neo-grotesk sans-serif.
- Light, regular, medium, and semibold weights.
- Avoid overly playful, decorative, or generic startup-style fonts.
- Avoid heavy display weights unless used briefly for a major hero moment.

#### Editorial Typography

For cinematic homepage scenes, use large, calm, spacious text with careful line breaks. The typography should feel like a luxury campaign, not a template headline.

Guidelines:

- Large hero text should have generous line-height.
- Letter spacing should remain natural.
- Avoid all-caps paragraphs.
- Use short phrases, not crowded marketing copy.
- Keep hierarchy clear and quiet.

### Spacing

Spacing should be generous and intentional.

- Use large vertical rhythm for homepage scenes.
- Let products breathe inside the grid.
- Avoid cramped sections.
- Avoid dense marketing blocks.
- Prefer fewer elements with more space.

Suggested spacing behavior:

- Homepage cinematic scenes may use full viewport or near-full viewport height.
- Product pages should use a practical commerce layout with premium spacing.
- Checkout should be compact enough to complete easily, but not visually crowded.

### Shadows

Shadows should be minimal and soft.

- Avoid heavy ecommerce card shadows.
- Use barely visible ambient shadows for product cards and modals.
- Prefer border, background contrast, and spacing over shadow.
- Glass effects may use subtle highlights instead of strong shadows.

### Borders

Borders should be thin, calm, and low-contrast.

- Use soft sand, pearl, or translucent slate-green borders.
- Border radius should be restrained.
- Avoid overly rounded pill-heavy layouts unless used for small controls.
- Product cards should feel polished, not bubbly.

### Button Style

Buttons should feel tactile, precise, and premium.

#### Primary Button

- Deep slate green or sea-glass green background.
- Pearl or ivory text.
- Medium weight text.
- Subtle hover lift or glow.
- Smooth transition.
- No loud color shifts.

#### Secondary Button

- Transparent or pearl background.
- Deep slate green text.
- Thin border.
- Soft hover fill.

#### Button Rules

- Keep labels short and clear.
- Use consistent height and padding.
- Avoid generic gradient buttons.
- Avoid excessive rounded corners.
- Use motion sparingly: opacity, translate, subtle scale, or highlight sweep.

### Product Card Style

Product cards should look like a premium skincare shelf, not a discount marketplace.

Each product card should include:

- Clean product image area.
- Product name.
- Brand or collection name if relevant.
- Short benefit or category label.
- Price.
- Clear action, such as `View Product` or `Add to Cart` when commerce is ready.

Card direction:

- Pearl or warm ivory background.
- Thin soft border.
- Minimal shadow.
- Product image with consistent aspect ratio.
- Calm hover interaction.
- No loud badges unless operationally necessary.
- Sale and stock states should be visually restrained.

## 3. Motion Principles

Motion should be cinematic but fast. The website should feel premium, smooth, and responsive, never slow or decorative for its own sake.

### Core Principles

- Cinematic but fast.
- Smooth scroll-driven transitions.
- No distracting animations.
- Premium fades, reveals, parallax, and glass highlights.
- Motion should support storytelling and clarity.
- Motion must never block shopping or checkout.
- Every animation must have a reason.

### Framer Motion

Use Framer Motion for UI-level animation:

- Page transitions.
- Component reveals.
- Product card hover states.
- Drawer and modal animation.
- Form feedback.
- Button interactions.
- Small content fade-ins.

### GSAP

Use GSAP for scroll storytelling:

- Homepage scene transitions.
- Scroll-linked text reveals.
- Logo reveal sequence.
- Parallax product or texture movement.
- Pinning only when it improves the story and remains performant.

### Motion Timing

- Reveals should feel smooth but brief.
- Avoid delays that make the site feel slow.
- Use easing that feels polished and natural.
- Avoid bouncy motion.
- Avoid excessive staggered animation.

### Accessibility

- Respect reduced motion preferences.
- Do not rely on motion alone to communicate meaning.
- Ensure all content remains readable without animation.

## 4. Homepage Blueprint

The homepage should unfold as a premium cinematic introduction to Atoreum MV. It should feel like a brand film translated into a website, but it must remain fast, readable, and practical.

### Scene 01: Beauty takes time.

#### Purpose

Open with calm confidence. Establish that Atoreum MV values patience, refinement, and quality.

#### Layout

- Full viewport or near-full viewport scene.
- Pearl white or warm ivory background.
- Large centered text.
- Very minimal supporting visual texture, such as soft light or subtle glass highlight.

#### Text

Beauty takes time.

#### Animation

- Slow fade in.
- Slight upward reveal.
- Text may hold briefly as the user begins scrolling.
- Background highlight can move subtly.

#### Mobile Behavior

- Centered text with generous side padding.
- Avoid oversized text that wraps awkwardly.
- Scene height can be slightly shorter than desktop while preserving impact.

#### Performance Notes

- Use CSS background and lightweight motion.
- Avoid large video or heavy texture here.

### Scene 02: So did we.

#### Purpose

Connect the idea of time to Atoreum MV's own creation process. Introduce the brand as carefully developed.

#### Layout

- Continue the minimal cinematic flow.
- Text may replace Scene 01 through scroll transition.
- Keep visual continuity.

#### Text

So did we.

#### Animation

- Crossfade from Scene 01.
- Slight parallax or text drift may be used.
- Keep the transition elegant and fast.

#### Mobile Behavior

- Preserve the same simple centered composition.
- Reduce parallax intensity.

#### Performance Notes

- Use shared scene container where possible.
- Avoid duplicating heavy effects.

### Scene 03: Brand reveal with logo

#### Purpose

Reveal Atoreum MV with a premium logo moment. This is the first clear brand identification.

#### Layout

- Centered logo.
- Tagline below.
- Pearl or sea-glass tinted background.
- Optional soft glass highlight passing over the logo.

#### Text

Atoreum MV  
Korean Beauty • Maldivian Soul

#### Animation

- Logo fades or scales in subtly.
- Tagline appears after the logo.
- Optional light sweep across logo, very subtle.

#### Mobile Behavior

- Logo should remain crisp and proportionate.
- Tagline should not be too small.
- Preserve adequate spacing between logo and tagline.

#### Performance Notes

- Use optimized logo asset.
- Do not animate expensive filters continuously.
- Preload critical logo if needed.

### Scene 04: Atoreum was not created to sell skincare. It was created to curate it.

#### Purpose

Define the brand philosophy. Separate Atoreum MV from generic ecommerce and trend-driven beauty selling.

#### Layout

- Editorial text composition.
- Large statement with line breaks.
- Optional small supporting caption.
- Warm ivory or pearl background.

#### Text

Atoreum was not created to sell skincare.  
It was created to curate it.

#### Animation

- Line-by-line reveal.
- Gentle fade and rise.
- No dramatic movement.

#### Mobile Behavior

- Break lines intentionally.
- Keep text readable without over-compressing.

#### Performance Notes

- Text-only section should be lightweight.
- Avoid unnecessary image assets.

### Scene 05: Beyond trends.

#### Purpose

Introduce the first `Beyond` statement. Position Atoreum MV as selective and timeless.

#### Layout

- Minimal scene.
- Large text aligned center or left depending on final rhythm.
- Optional faint product silhouette or texture.

#### Text

Beyond trends.

#### Animation

- Scroll reveal.
- Text may enter from a soft blur to crisp opacity.
- Keep blur subtle for performance.

#### Mobile Behavior

- Use simple fade rather than complex scroll effects.
- Maintain strong text contrast.

#### Performance Notes

- Avoid heavy blur animations on low-end devices.

### Scene 06: Beyond ordinary skincare.

#### Purpose

Raise the quality promise. The brand offers skincare selected for effectiveness, experience, and trust.

#### Layout

- Continue the `Beyond` rhythm.
- Add slightly more visual depth, possibly a product texture or glass reflection.

#### Text

Beyond ordinary skincare.

#### Animation

- Smooth continuation from Scene 05.
- Slight horizontal or vertical text movement tied to scroll.

#### Mobile Behavior

- Keep phrase readable on two lines if necessary.
- Reduce movement.

#### Performance Notes

- Reuse existing visual layers where possible.

### Scene 07: Beyond borders.

#### Purpose

Introduce the bridge between Korea and the Maldives.

#### Layout

- A wider spatial scene.
- Visual transition from Korean skincare minimalism to Maldivian softness.
- Possible split of subtle tones: pearl and sea-glass.

#### Text

Beyond borders.

#### Animation

- Gentle transition into geographic storytelling.
- Background may shift tone from ivory to sea-glass.

#### Mobile Behavior

- Avoid literal map complexity.
- Keep it abstract and elegant.

#### Performance Notes

- Prefer CSS gradients or lightweight imagery.
- Avoid heavy map libraries.

### Scene 08: Korea.

#### Purpose

Anchor the source of skincare innovation and product origin.

#### Layout

- Minimal text scene.
- Optional refined image detail inspired by Korean skincare: product lab, texture, packaging, or ingredient close-up.

#### Text

Korea.

#### Animation

- Text appears with a calm pause.
- Visual layer may move slowly with scroll.

#### Mobile Behavior

- Image, if used, should crop elegantly.
- Text should remain dominant.

#### Performance Notes

- Use optimized responsive images.
- Avoid decorative stock imagery that weakens the brand.

### Scene 09: Carefully selected.

#### Purpose

Communicate curation standards.

#### Layout

- Editorial statement with small supporting copy.
- Could include three small criteria later: quality, trust, suitability.

#### Text

Carefully selected.

Optional supporting copy:

Chosen for quality, texture, performance, and trust.

#### Animation

- Main phrase reveals first.
- Supporting line fades in after.

#### Mobile Behavior

- Supporting copy should remain short.
- Stack content vertically.

#### Performance Notes

- Keep text animation simple.

### Scene 10: Directly sourced.

#### Purpose

Build trust around supply chain and authenticity.

#### Layout

- Clean, confident composition.
- May include abstract line movement suggesting direct sourcing.

#### Text

Directly sourced.

Optional supporting copy:

From trusted Korean skincare partners.

#### Animation

- Line or highlight moves subtly from source to destination.
- Keep it refined, not infographic-heavy.

#### Mobile Behavior

- Use a simple fade reveal.
- Avoid tiny diagram elements.

#### Performance Notes

- Use CSS or SVG sparingly if a line visual is needed.

### Scene 11: Curated for the Maldives.

#### Purpose

Bring the story home. Make clear the products are selected with the Maldivian climate, customer, and lifestyle in mind.

#### Layout

- Warm, elegant Maldivian-inspired scene.
- Sea-glass, pearl, and soft sand tones.
- Optional product and light composition.

#### Text

Curated for the Maldives.

Optional supporting copy:

Skincare chosen for island life, daily rituals, and lasting glow.

#### Animation

- Soft reveal with subtle parallax.
- The scene should feel lighter and more open than previous scenes.

#### Mobile Behavior

- Text over image only if contrast is excellent.
- Otherwise stack text and image.

#### Performance Notes

- Use optimized imagery.
- Avoid dark overlays unless necessary for readability.

### Scene 12: Featured collection teaser.

#### Purpose

Transition from brand story into commerce. Show that Atoreum MV has real products to explore.

#### Layout

- Product teaser grid or horizontal collection strip.
- 3 to 4 featured products on desktop.
- 1 to 2 visible products on mobile with horizontal scroll or stacked cards.

#### Text

Featured Collection

Optional supporting copy:

Selected Korean skincare essentials for refined daily care.

#### Animation

- Product cards fade in with subtle stagger.
- Hover interaction on desktop.
- No excessive card movement.

#### Mobile Behavior

- Use horizontal scroll with snap or a clean stacked layout.
- Maintain image aspect ratios.
- Buttons must be easy to tap.

#### Performance Notes

- Lazy load non-critical product images.
- Use responsive image sizes.
- Avoid layout shift by defining image dimensions.

### Scene 13: Explore Products.

#### Purpose

End the homepage journey with a clear action.

#### Layout

- Strong but minimal final CTA.
- Deep slate green or pearl background depending on page rhythm.
- Button to products page.

#### Text

Explore Products

Optional supporting copy:

Discover curated Korean skincare for the Maldives.

#### Animation

- CTA fades in.
- Button hover should be polished and restrained.

#### Mobile Behavior

- Full-width or comfortably wide button.
- Keep copy short.

#### Performance Notes

- Keep final CTA lightweight.
- Ensure route prefetching is sensible.

## 5. Products Page Blueprint

The products experience should feel premium and practical. It must support discovery, product confidence, and a simple path to purchase.

### Product Listing

The listing page should include:

- Page title: Products or Curated Skincare.
- Short editorial intro.
- Product grid.
- Product cards with consistent image ratios.
- Product name.
- Category or benefit label.
- Price.
- Availability status if needed.
- Link to product detail page.

Desktop layout:

- 3 or 4-column grid depending on image size and content density.
- Generous spacing.
- Quiet filters later.

Mobile layout:

- 1 or 2-column grid depending on card readability.
- Clear tap targets.
- Avoid crowded text.

### Product Detail Page

Each product detail page should include:

- Product gallery.
- Product title.
- Brand or collection if relevant.
- Price.
- Quantity selector.
- Add to checkout or purchase action.
- Description.
- Benefits.
- Ingredients.
- How to use.
- Delivery or bank transfer note if needed.

The page should prioritize confidence and clarity. It should not feel overloaded.

### Gallery

Gallery requirements:

- Main product image.
- Secondary images for packaging, texture, application, and detail if available.
- Thumbnail navigation on desktop.
- Swipe-friendly behavior on mobile.
- Defined image dimensions to prevent layout shift.
- Optimized images with alt text.

### Description

Descriptions should be concise, editorial, and benefit-led. Avoid exaggerated claims.

Recommended structure:

- Short overview.
- Texture or feel.
- Ideal skin concerns or routine step.
- Why Atoreum selected it.

### Benefits

Benefits should be scannable.

Examples:

- Hydrates and softens.
- Supports a calm-looking complexion.
- Helps strengthen the skin barrier.
- Lightweight daily texture.

All claims must remain accurate to the product.

### Ingredients

Ingredients should include:

- Full ingredient list when available.
- Key ingredients section.
- Plain-language explanation for important ingredients.
- Allergy or sensitivity note if relevant.

### How to Use

How-to-use content should be practical:

- Routine step.
- Amount.
- Time of use.
- Layering guidance.
- Sunscreen reminder where relevant.

### Price

Price should be clearly visible and formatted consistently for the Maldives market.

Recommended:

- Use MVR pricing.
- Keep currency formatting consistent.
- Avoid visual clutter around price.

### Quantity

Quantity selector should be simple:

- Minus button.
- Quantity value.
- Plus button.
- Stock-aware behavior later.
- Prevent invalid quantities.

### Bank Transfer Checkout

The product page should lead into bank transfer checkout. Since payment is manual, the flow must be especially clear.

User should understand:

- What they are ordering.
- Total amount.
- How to transfer.
- What happens after confirmation.

### Future Filters and Search

Future listing enhancements:

- Search by product name.
- Filter by skin concern.
- Filter by category.
- Filter by routine step.
- Filter by price range.
- Filter by availability.
- Sort by newest, price, or curated order.

Filters should be quiet and refined. Avoid marketplace-style clutter.

## 6. Checkout Blueprint

Checkout is bank transfer only. It should be simple, reassuring, and easy to complete.

### Required Fields

- Customer name.
- Phone number.
- Delivery address.
- Product summary.
- Quantity.
- Total.

### Product Summary

The checkout summary should show:

- Product image thumbnail.
- Product name.
- Unit price.
- Quantity.
- Line total.
- Order total.

### Customer Information

Fields:

- Full name.
- Phone number.
- Delivery address.
- Optional note if useful later.

Validation:

- Name is required.
- Phone number is required.
- Delivery address is required.
- Quantity must be valid.

### Bank Transfer Instructions

Bank transfer instructions should be clear and highly visible after the order summary.

Include:

- Bank name.
- Account name.
- Account number.
- Transfer amount.
- Reference instruction, such as customer name or order number.
- Note that order processing begins after payment confirmation.

The exact bank details should be stored in configuration or content data, not scattered across components.

### Optional Receipt Upload Later

Future enhancement:

- Allow customer to upload transfer receipt.
- Accepted formats: image or PDF.
- File size limits.
- Receipt linked to order.
- Admin can review receipt and mark paid.

This should not be required for the first phase unless implementation scope allows it.

### Order Confirmation

After checkout submission, show an order confirmation screen:

- Thank-you message.
- Order number.
- Product summary.
- Total amount.
- Bank transfer instructions.
- Customer phone confirmation.
- Expected next step.

The confirmation page should be calm, clear, and trustworthy.

## 7. Journal Blueprint

The Journal will support future skincare education, SEO, and brand authority. It should feel like a refined skincare editorial library, not a generic blog.

### Content Categories

- Ingredient guides.
- Skincare routines.
- Product education.
- Korean skincare tips.
- Climate-specific skincare advice for the Maldives.
- Brand and sourcing stories.

### Ingredient Guides

Potential topics:

- Hyaluronic acid.
- Centella asiatica.
- Niacinamide.
- Ceramides.
- Propolis.
- Rice extract.
- Heartleaf.

Each guide should explain:

- What the ingredient is.
- What it does.
- Who it may suit.
- How to use it.
- Product recommendations when available.

### Skincare Routines

Routine content should be practical:

- Morning routine.
- Evening routine.
- Hydration routine.
- Barrier care routine.
- Routine for humid climates.
- Routine for sensitive skin.

### Product Education

Product education content should explain:

- Product texture.
- Routine step.
- Benefits.
- Key ingredients.
- Who it is for.
- What to pair it with.

### Korean Skincare Tips

Topics may include:

- Layering lightweight products.
- Essence versus toner.
- Sunscreen habits.
- Barrier-first skincare.
- Gentle cleansing.
- Hydration-focused routines.

### SEO Content

Journal content should support search visibility with:

- Clear titles.
- Useful metadata.
- Structured headings.
- Internal links to products.
- Relevant schema where appropriate.
- Descriptive image alt text.
- Human-first writing, not keyword stuffing.

## 8. Admin Roadmap

Admin functionality is future scope. Initial builds can use static or structured data files, but the architecture should not block a later admin system.

### Future Admin Capabilities

- Add products.
- Edit products.
- Upload product images.
- Manage prices.
- Manage stock.
- View orders.
- View customer details.
- Mark orders as paid.
- Mark orders as completed.
- Update bank transfer details.
- Manage featured products.
- Publish journal articles.

### Product Management

Admin should eventually support:

- Product name.
- Slug.
- Short description.
- Full description.
- Price.
- Stock.
- Category.
- Benefits.
- Ingredients.
- How to use.
- Product images.
- Featured status.

### Order Management

Admin should eventually support:

- Order list.
- Order detail.
- Customer name.
- Phone number.
- Delivery address.
- Product summary.
- Quantity.
- Total.
- Payment status.
- Fulfillment status.
- Receipt attachment if implemented.

## 9. Technical Architecture

### Framework

Use Next.js App Router with TypeScript.

Core stack:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Framer Motion.
- GSAP.

### App Structure Direction

Recommended structure:

- `app/` for routes, layouts, metadata, and pages.
- `components/` for reusable UI and section components.
- `components/home/` for homepage scenes.
- `components/products/` for product cards, galleries, and product UI.
- `components/checkout/` for checkout form and summary.
- `lib/` for data, helpers, constants, and formatting.
- `public/` for static assets.
- `styles/` for global styles and theme foundations.

### Component Structure

Components should be small, focused, and purposeful.

Recommended components:

- `SiteHeader`
- `SiteFooter`
- `LogoMark`
- `Button`
- `ProductCard`
- `ProductGrid`
- `ProductGallery`
- `QuantitySelector`
- `CheckoutSummary`
- `BankTransferInstructions`
- `HomeScene`
- `FeaturedCollection`

Avoid building overly abstract components before there is repeated need.

### Data Structure

Early product data may live in structured TypeScript files.

Recommended product fields:

- `id`
- `slug`
- `name`
- `brand`
- `category`
- `price`
- `currency`
- `shortDescription`
- `description`
- `benefits`
- `ingredients`
- `keyIngredients`
- `howToUse`
- `images`
- `featured`
- `stockStatus`

Bank transfer details should live in a single config object.

### SEO

SEO should be built into the App Router metadata system.

Requirements:

- Unique title and description per page.
- Product detail metadata.
- Open Graph images when available.
- Descriptive image alt text.
- Clean URLs.
- Structured data for products when product information is complete.
- Journal article metadata when Journal launches.

### Accessibility

Accessibility is part of the premium experience.

Requirements:

- Semantic HTML.
- Proper heading order.
- Keyboard-accessible navigation and controls.
- Visible focus states.
- Sufficient color contrast.
- Accessible form labels and errors.
- Alt text for meaningful images.
- Reduced motion support.
- Buttons and links used correctly.

### Performance

Performance must remain a priority, especially because the homepage uses motion.

Requirements:

- Optimize images.
- Use responsive image sizes.
- Avoid layout shift.
- Lazy load non-critical media.
- Keep JavaScript lean.
- Use GSAP only where scroll storytelling requires it.
- Use Framer Motion for focused UI animation.
- Avoid unnecessary dependencies.
- Test mobile behavior.
- Keep animations efficient.

## 10. Development Rules for Codex

These rules apply to all future implementation work on the Atoreum MV website.

### Brand Rules

- Do not redesign the logo.
- Do not alter the logo proportions, colors, or mark unless explicitly instructed.
- Follow this blueprint as the source of truth.
- Keep the site minimal, refined, calm, and premium.
- Avoid generic templates.
- Avoid loud ecommerce styling.
- Avoid cluttered sections and unnecessary copy.
- Use Korean skincare and subtle Maldivian elegance as the visual foundation.

### Implementation Rules

- Build in small phases.
- Keep changes scoped.
- Prefer existing project patterns.
- Do not add unnecessary dependencies.
- Use TypeScript intentionally.
- Keep components readable and maintainable.
- Do not introduce large abstractions without need.
- Use structured data for products and configuration.
- Keep checkout simple until payment requirements expand.

### Motion Rules

- Use Framer Motion for UI interactions.
- Use GSAP for scroll storytelling.
- Respect reduced motion preferences.
- Keep animations fast and purposeful.
- Do not add distracting or decorative animation.
- Do not let motion harm readability, accessibility, or performance.

### Quality Rules

- Always run lint, typecheck, and build after code changes.
- Fix errors before considering implementation complete.
- Verify responsive behavior.
- Verify core user flows.
- Check that text does not overlap or overflow.
- Check that product images preserve layout stability.

### Dependency Rules

- Do not add dependencies unless there is a clear reason.
- Prefer platform, Next.js, React, Tailwind, Framer Motion, and GSAP capabilities already in scope.
- Avoid installing UI kits that would dilute the brand.
- Avoid adding animation libraries beyond Framer Motion and GSAP.

### Content Rules

- Keep copy concise and premium.
- Avoid exaggerated claims.
- Avoid generic skincare marketplace language.
- Use calm, confident, editorial phrasing.
- Make product information clear and useful.
- Preserve the tagline exactly: Korean Beauty • Maldivian Soul.

### Phase Guidance

Recommended development phases:

1. Establish theme tokens, typography, layout shell, header, and footer.
2. Build cinematic homepage scenes with placeholder-safe product teaser.
3. Build product listing and structured product data.
4. Build product detail pages.
5. Build bank transfer checkout.
6. Add order confirmation.
7. Add Journal foundation.
8. Add admin functionality when backend scope is defined.

