import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 80],
    // Payment-proof and admin-uploaded product images now live in Supabase
    // Storage (see lib/storage.ts) rather than under /public — next/image
    // needs any external host it's asked to optimize explicitly allowlisted.
    // Wildcarded at the subdomain level since it covers any Supabase
    // project's storage URL without hardcoding this project's specific ref.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
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
