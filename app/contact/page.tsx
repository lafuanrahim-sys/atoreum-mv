import type { Metadata } from "next";
import { submitMessageAction } from "@/app/actions/messages";

export const metadata: Metadata = {
  title: "Contact — Atoreum MV",
  description: "Get in touch with Atoreum MV — call, email, or send us a note.",
};

/**
 * Quiet two-column contact composition: a large display statement with the
 * direct lines on the left, a minimal message form on the right. All type,
 * color, and spacing come from the site's existing tokens.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent = "", error = "" } = await searchParams;

  return (
    <div className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
        {/* Left: statement + direct contact lines */}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Contact</p>
          <h1 className="mt-6 font-display text-4xl leading-[1.15] text-ivory md:text-5xl">
            Let&apos;s talk skincare
            <br />
            <em className="italic text-gold">— we&apos;re listening.</em>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ivory-dim">
            Questions about an order, a formula, or the launch? Call, write, or
            leave us a note — we reply from Malé, usually within the day.
          </p>

          <dl className="mt-12 flex flex-col gap-8 border-t border-line pt-10">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Phone</dt>
              <dd className="mt-2">
                <a
                  href="tel:+9607439030"
                  className="font-display text-2xl text-ivory transition-colors hover:text-gold md:text-3xl"
                >
                  +960 743 9030
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Inquiries</dt>
              <dd className="mt-2">
                <a
                  href="mailto:sales@aranzo.co"
                  className="font-display text-2xl text-ivory transition-colors hover:text-gold md:text-3xl"
                >
                  sales@aranzo.co
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Based in</dt>
              <dd className="mt-2 text-base text-ivory-dim">Malé, Maldives</dd>
            </div>
          </dl>
        </div>

        {/* Right: message form */}
        <div className="lg:pt-24">
          {sent ? (
            <div className="border border-line p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Message sent</p>
              <h2 className="mt-4 font-display text-2xl text-ivory">
                Thank you — we&apos;ve received your note.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">
                We&apos;ll get back to you on the number you left. For anything urgent,
                call{" "}
                <a href="tel:+9607439030" className="text-gold hover:underline">
                  +960 743 9030
                </a>
                .
              </p>
            </div>
          ) : (
            <form action={submitMessageAction} className="flex flex-col gap-6">
              {/* Honeypot — hidden from real visitors, catches naive bots. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              {error && (
                <p role="alert" className="text-sm text-red-400">
                  Please fill in your name, contact number, and a message.
                </p>
              )}

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
                  Contact number
                </span>
                <input
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">
                  Notes or suggestions
                </span>
                <textarea
                  name="message"
                  rows={6}
                  required
                  maxLength={2000}
                  className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="self-start bg-gold-deep px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
