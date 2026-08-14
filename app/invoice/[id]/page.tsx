import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/data/orders.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { buildInvoice, formatMoney, invoiceNumber } from "@/lib/invoice";
import { STORE_DETAILS } from "@/lib/storeDetails";
import PrintButton from "@/components/dashboard/PrintButton";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/**
 * A tax invoice for one order, GST broken out, laid out to be printed or
 * saved as PDF straight from the browser (Ctrl+P -> Save as PDF). No PDF
 * library: the browser already renders and paginates HTML to PDF perfectly
 * well, and adding a renderer would mean shipping a headless-Chrome-sized
 * dependency to produce the same page this already is.
 *
 * Lives OUTSIDE /dashboard on purpose. It began as a route under the
 * dashboard and printed across three sheets no matter what the print CSS
 * said: the shell is `min-h-screen` with fixed-position chrome, a fixed
 * element repeats on every printed page, and unwinding someone else's layout
 * from a descendant stylesheet is a losing game -- `body > * { display:none }`
 * still produced three pages. A document meant for paper should not be nested
 * inside an application shell at all. Out here there is nothing to hide, so
 * the print rules are a handful of lines instead of a fight.
 *
 * Still admin-only: the auth check below is the real gate, and it does not
 * depend on the dashboard layout to enforce it.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const invoice = buildInvoice(order);
  const issued = new Date(order.createdAt);

  return (
    <div className="invoice-print mx-auto max-w-3xl">
      {/* Scoped to this route by construction: the rule only exists in the
          document while an invoice is on screen, so nothing else on the site
          gets forced onto A5. It has to be un-nested and un-named for Chrome
          to size the sheet from it -- see the note in globals.css. */}
      <style>{"@page { size: A5 landscape; margin: 8mm; }"}</style>
      {/* Screen-only controls. `print:hidden` keeps them off the paper. */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/orders/${order.id}`}
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim hover:text-gold-deep"
        >
          ← Back to order
        </Link>
        <PrintButton />
      </div>

      <article className="invoice-document border border-line bg-ink p-10 text-ivory">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            {/* Registered taxpayer first, trading name under it. The
                document has to name the person MIRA holds liable for the
                output tax, not the shopfront. */}
            <p className="font-display text-xl tracking-[0.2em] uppercase">
              {STORE_DETAILS.taxpayerName}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim">
              trading as {STORE_DETAILS.tradingName}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ivory-dim">
              {STORE_DETAILS.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {STORE_DETAILS.email}
              {STORE_DETAILS.phone ? ` · ${STORE_DETAILS.phone}` : ""}
            </p>
            {/* A mandatory particular on a Maldivian tax invoice, so it is
                given its own line rather than folded into the address block. */}
            {STORE_DETAILS.tin && (
              <p className="mt-2 font-mono text-xs text-ivory">TIN {STORE_DETAILS.tin}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Tax Invoice</p>
            <p className="mt-2 font-mono text-lg tabular-nums">{invoiceNumber(order)}</p>
            <p className="mt-1 font-mono text-[11px] text-ivory-dim tabular-nums">
              {issued.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ivory-dim">Order {order.orderNumber}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Billed to</p>
            <p className="mt-2 text-sm text-ivory">{order.customer.name}</p>
            <p className="text-xs leading-relaxed text-ivory-dim">
              {order.customer.address}
              <span className="block">{order.customer.email}</span>
              <span className="block">{order.customer.phone}</span>
            </p>
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Payment</p>
            <p className="mt-2 text-sm text-ivory">
              {order.paymentMethod === "cash" ? "Cash on delivery" : "Bank transfer"}
            </p>
            <p className="text-xs text-ivory-dim">Status: {order.status}</p>
          </div>
        </section>

        {order.customer.notes && (
          <p className="mt-4 border-l-2 border-line pl-3 text-xs leading-relaxed text-ivory-dim">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Note: </span>
            {order.customer.notes}
          </p>
        )}

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ivory text-left">
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">Description</th>
              <th className="py-2 pr-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">Qty</th>
              <th className="py-2 pr-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">Unit (incl.)</th>
              <th className="py-2 pr-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">Net</th>
              <th className="py-2 pr-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">GST {invoice.gstRatePercent}%</th>
              <th className="py-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-ivory-dim">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.productId + line.name} className="border-b border-line">
                <td className="py-2.5 pr-3 text-ivory">{line.name}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-ivory-dim">{line.quantity}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-ivory-dim">
                  {/* Struck list price above the charged one, so the discount
                      is visible on the line it applies to rather than only as
                      a total at the foot. */}
                  {line.listUnitGross !== null && (
                    <s className="mr-1.5 text-ivory-dim/60">{line.listUnitGross.toFixed(2)}</s>
                  )}
                  {line.unitGross.toFixed(2)}
                  {line.discountPercent !== null && (
                    <span className="ml-1 text-[10px] text-gold">-{Math.round(line.discountPercent)}%</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-ivory-dim">{line.lineNet.toFixed(2)}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-ivory-dim">{line.lineGst.toFixed(2)}</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-ivory">{line.lineGross.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs text-sm">
            {invoice.productSavings > 0 && (
              <>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ivory-dim">Before discount</dt>
                  <dd className="font-mono tabular-nums text-ivory-dim">
                    {formatMoney(invoice.grossBeforeProductDiscounts, invoice.currency)}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ivory-dim">Product discount</dt>
                  <dd className="font-mono tabular-nums text-ivory-dim">
                    -{formatMoney(invoice.productSavings, invoice.currency)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between py-1.5">
              <dt className="text-ivory-dim">Subtotal (incl. GST)</dt>
              <dd className="font-mono tabular-nums text-ivory-dim">{formatMoney(invoice.grossSubtotal, invoice.currency)}</dd>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between py-1.5">
                <dt className="text-ivory-dim">
                  Sangu redeemed{order.boliRedeemed ? ` (${order.boliRedeemed.toLocaleString()})` : ""}
                </dt>
                <dd className="font-mono tabular-nums text-ivory-dim">-{formatMoney(invoice.discount, invoice.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line py-1.5">
              <dt className="text-ivory-dim">Taxable value</dt>
              <dd className="font-mono tabular-nums text-ivory-dim">{formatMoney(invoice.netTotal, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-ivory-dim">GST @ {invoice.gstRatePercent}%</dt>
              <dd className="font-mono tabular-nums text-ivory-dim">{formatMoney(invoice.gstTotal, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-ivory py-2.5">
              <dt className="font-mono text-xs uppercase tracking-[0.15em] text-ivory">Total</dt>
              <dd className="font-mono text-base tabular-nums text-ivory">{formatMoney(invoice.grossTotal, invoice.currency)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ivory-dim">
          <p>
            Prices shown are GST-inclusive; the GST above is the tax contained within the total, at{" "}
            {invoice.gstRatePercent}%.
          </p>
          <p className="mt-1">Thank you for shopping with {STORE_DETAILS.tradingName}.</p>
        </footer>
      </article>
    </div>
  );
}
