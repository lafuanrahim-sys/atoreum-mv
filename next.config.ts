import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
