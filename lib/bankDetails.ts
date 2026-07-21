/**
 * Bank transfer details shown on the checkout payment step. PLACEHOLDER
 * VALUES — replace with the real account before launch.
 *
 * These are NEXT_PUBLIC_-prefixed (and so bundled into client JS) because
 * they're meant to be displayed to customers — there's no secrecy
 * requirement here, unlike ADMIN_PASSWORD/ADMIN_SESSION_SECRET. Set the
 * real values in .env.local before deploying.
 */
export const bankDetails = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Bank of Maldives (placeholder)",
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "Atoreum MV Pvt Ltd (placeholder)",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "0000-0000-0000 (placeholder)",
  swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "MALBMVMV (placeholder)",
};
