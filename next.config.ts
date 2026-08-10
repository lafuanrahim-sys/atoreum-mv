import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 *
 * Written against what the site actually loads, checked by crawling the live
 * pages and reading every request origin: everything is same-origin, because
 * next/image proxies the Supabase-hosted product and payment-proof images
 * through /_next/image rather than hot-linking them.
 *
 * On 'unsafe-inline' for scripts, which is the one genuinely weak directive
 * here: the App Router inlines its own bootstrap and streams the RSC payload
 * as inline <script> tags, and the only way to allow those specifically is a
 * per-request nonce, which forces every page to render dynamically and gives
 * up static optimisation for the whole storefront. That trade isn't worth it
 * here, because the XSS this would mitigate has no route in: the app has
 * exactly one dangerouslySetInnerHTML and it renders a static developer
 * constant, and React escapes everything else by default.
 *
 * The directives that carry real weight regardless are kept strict:
 *   object-src 'none'   kills Flash/applet-style plugin injection outright
 *   base-uri 'self'     stops an injected <base> repointing every relative URL
 *   form-action 'self'  stops an injected form posting credentials off-site
 *   frame-ancestors     clickjacking, and it supersedes X-Frame-Options
 *
 * 'unsafe-eval' is dev-only: React Fast Refresh needs it, production does not.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind ships compiled, but the site sets style="" attributes directly
  // (GSAP writes transforms inline, and several components position elements
  // by style). Nonces cannot cover style attributes, only style elements.
  "style-src 'self' 'unsafe-inline'",
  // blob: for the local object-URL previews on the checkout receipt and
  // product image pickers; the Supabase host as a fallback for the few raw
  // <img> tags that skip the optimizer.
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces with frame-ancestors above: older browsers honour only
  // this one.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site but never the path — the account and dashboard
  // URLs carry ids that shouldn't leak in a Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs any of these; denying them means an injected iframe or
  // script can't prompt for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Vercel serves this over HTTPS; the header is what stops a first-request
  // downgrade. Deliberately no `preload` — that submits the domain to a
  // browser-baked list which is slow and painful to reverse, and should be a
  // decision taken on purpose rather than picked up from a config file.
  ...(isDev ? {} : { poweredByHeader: false }),
  images: {
    qualities: [75, 80],
    // Payment-proof and admin-uploaded product images now live in Supabase
    // Storage (see lib/storage.ts) rather than under /public — next/image
    // needs any external host it's asked to optimize explicitly allowlisted.
    // Wildcarded at the subdomain level since it covers any Supabase
    // project's storage URL without hardcoding this project's specific ref.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // HSTS only in production: sending it from a local http dev server
          // would pin localhost to https in the browser and break dev for
          // every other project on the machine.
          ...(isDev
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Checkout accepts payment-proof uploads up to 8MB (see
      // MAX_FILE_BYTES in app/actions/checkout.ts); Next's default 1MB
      // Server Action body limit was rejecting those before that check
      // even ran, which surfaced to the browser as a generic
      // "Failed to fetch" error.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
