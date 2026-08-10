/**
 * The seller's particulars as they must appear on a tax invoice.
 *
 * `taxpayerName` and `tradingName` are deliberately separate. The business is
 * registered with MIRA as Aranzo Investments (TIN 1185609); "Atoreum MV" is
 * the storefront's trading name. A tax invoice has to be issued in the name
 * of the registered person, so the invoice leads with the taxpayer name and
 * carries the trading name underneath -- the customer recognises the shop
 * they bought from, and the document still names the entity that owes the
 * output tax.
 *
 * The TIN is hardcoded rather than read from the environment. It is not a
 * secret -- it is printed on every invoice by design -- and an env var that
 * happens to be unset in production would silently produce invoices missing
 * a mandatory particular. An override is still honoured for anyone running
 * this against a different entity.
 */
export const STORE_DETAILS = {
  /** Registered taxpayer, per the MIRA registration. */
  taxpayerName: "Aranzo Investments",
  /** The name customers know the shop by. */
  tradingName: "Atoreum MV",
  addressLines: ["Malé, Republic of Maldives"],
  email: "sales@aranzo.co",
  phone: "",
  tin: process.env.STORE_TIN ?? "1185609",
} as const;
