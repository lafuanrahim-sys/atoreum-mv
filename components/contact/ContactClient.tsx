"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { submitMessageAction } from "@/app/actions/messages";
import { prefersReducedMotion, reveal, splitWordReveal } from "@/lib/motion";
import WordMask from "@/components/ui/WordMask";

gsap.registerPlugin(ScrollTrigger);

/** Current wall-clock time in Malé, or null before the client knows it. */
function useMaleTime(): string | null {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Indian/Maldives",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
    setTime(format());
    const tick = setInterval(() => setTime(format()), 30_000);
    return () => clearInterval(tick);
  }, []);
  return time;
}

/**
 * The contact page as a conversation: while the visitor fills the form, a
 * note card on the left is "addressed" in real time with their name, number,
 * and words — writing to the store feels like writing an actual note that
 * will be read in Malé. A slowly turning postmark and a live Malé clock keep
 * the destination present; the card drifts gently (same liquid vocabulary as
 * the rest of the site). All decoration is aria-hidden — the real form is
 * plain, labelled, and works without JS.
 */
export default function ContactClient({ sent, error }: { sent: boolean; error: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const stampRef = useRef<SVGSVGElement | null>(null);
  const sendRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const maleTime = useMaleTime();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      reveal(root.querySelectorAll("[data-reveal]"), {
        y: 22,
        duration: 0.9,
        stagger: 0.09,
        start: "top 85%",
        trigger: root,
      });

      const title = root.querySelector(".contact-title");
      if (title) splitWordReveal(title, { start: "top 88%" });

      // The note drifts like everything else on the site — barely.
      if (cardRef.current) {
        gsap.to(cardRef.current, {
          y: -7,
          rotate: -0.5,
          duration: 5.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }

      // Postmark turns like a slow ceiling fan; decorative only.
      if (stampRef.current) {
        gsap.to(stampRef.current, { rotate: 360, duration: 45, ease: "none", repeat: -1 });
      }

      // Magnetic send button — the page's single magnetic element.
      const send = sendRef.current;
      if (send && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const xTo = gsap.quickTo(send, "x", { duration: 0.5, ease: "elastic.out(1,0.45)" });
        const yTo = gsap.quickTo(send, "y", { duration: 0.5, ease: "elastic.out(1,0.45)" });
        const onMove = (event: MouseEvent) => {
          const rect = send.getBoundingClientRect();
          xTo((event.clientX - rect.left - rect.width / 2) * 0.35);
          yTo((event.clientY - rect.top - rect.height / 2) * 0.35);
        };
        const onLeave = () => {
          xTo(0);
          yTo(0);
        };
        const zone = send.parentElement ?? send;
        zone.addEventListener("mousemove", onMove);
        zone.addEventListener("mouseleave", onLeave);
        return () => {
          zone.removeEventListener("mousemove", onMove);
          zone.removeEventListener("mouseleave", onLeave);
        };
      }
    }, root);
    return () => ctx.revert();
  }, []);

  const excerpt = message.trim().slice(0, 140);

  return (
    <div ref={rootRef} className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
        {/* Left: statement, the live note, direct lines */}
        <div>
          <p data-reveal className="text-xs uppercase tracking-[0.3em] text-gold">
            Contact
          </p>
          <h1 className="contact-title mt-6 font-display text-4xl leading-[1.15] text-ivory md:text-5xl">
            <WordMask text="Write us a note. We're listening." />
          </h1>

          <p data-reveal className="mt-6 flex items-center gap-3 text-sm text-ivory-dim">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            {maleTime ? (
              <>It&apos;s {maleTime} in Malé, and we reply within the day.</>
            ) : (
              <>We reply from Malé within the day.</>
            )}
          </p>

          {/* The live note — fills in as the visitor types. */}
          <div
            ref={cardRef}
            aria-hidden="true"
            data-reveal
            className="relative mt-12 max-w-md border border-line bg-ink-2 p-8 will-change-transform"
          >
            <svg
              ref={stampRef}
              viewBox="0 0 100 100"
              className="absolute -right-7 -top-7 h-24 w-24 text-gold opacity-70 will-change-transform"
            >
              <defs>
                <path id="stamp-arc" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
              </defs>
              <circle cx="50" cy="50" r="47" fill="var(--ink)" stroke="currentColor" strokeWidth="1" />
              <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="0.75" />
              <text fill="currentColor" fontSize="11" letterSpacing="4">
                <textPath href="#stamp-arc" startOffset="8">ATOREUM MV · MALÉ 20-02</textPath>
              </text>
            </svg>

            <p className="text-[10px] uppercase tracking-[0.25em] text-ivory-dim">
              A note to Atoreum MV
            </p>
            <p className="mt-6 font-display text-xl leading-relaxed text-ivory">
              {excerpt ? (
                <>
                  &ldquo;{excerpt}
                  {message.trim().length > 140 ? "…" : ""}&rdquo;
                </>
              ) : (
                <span className="text-ivory-dim/60">
                  &ldquo;Your words appear here as you write…&rdquo;
                </span>
              )}
            </p>
            <div className="mt-8 border-t border-line pt-4 text-sm">
              <p className={name ? "text-ivory" : "text-ivory-dim/60"}>
                From {name || "Your name"}
              </p>
              <p className={`mt-1 tabular-nums ${phone ? "text-ivory-dim" : "text-ivory-dim/60"}`}>
                {phone || "+960 · · · · · · ·"}
              </p>
            </div>
          </div>

          <dl data-reveal className="mt-12 flex flex-col gap-6 border-t border-line pt-10">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Phone</dt>
              <dd className="mt-2">
                <a
                  href="tel:+9607439030"
                  className="font-display text-2xl text-ivory transition-colors hover:text-gold"
                >
                  +960 743 9030
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-ivory-dim">Inquiries</dt>
              <dd className="mt-2">
                <a
                  href="mailto:sales@atoreum.mv"
                  className="font-display text-2xl text-ivory transition-colors hover:text-gold"
                >
                  sales@atoreum.mv
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Right: the form itself */}
        <div className="lg:pt-24">
          {sent ? (
            <div className="border border-line p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Message sent</p>
              <h2 className="mt-4 font-display text-2xl text-ivory">
                Thank you. We&apos;ve received your note.
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
            <form action={submitMessageAction} data-reveal className="flex flex-col gap-7">
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

              <Field label="Name">
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:outline-none"
                />
              </Field>

              <Field label="Contact number">
                <input
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:outline-none"
                />
              </Field>

              <Field label="Notes or suggestions">
                <textarea
                  name="message"
                  rows={6}
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:outline-none"
                />
              </Field>

              <div className="self-start py-3">
                <div ref={sendRef} className="will-change-transform">
                  <button
                    type="submit"
                    className="bg-gold-deep px-8 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
                  >
                    Send the note
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Field with focus choreography: the label letter-spacing eases out and a
 * gold underline draws across the control while it's focused. Pure CSS
 * (group-focus-within) — no JS, works for keyboard users identically.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="group flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim transition-all duration-500 group-focus-within:tracking-[0.3em] group-focus-within:text-gold">
        {label}
      </span>
      <span className="relative block">
        {children}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gold transition-transform duration-500 ease-out group-focus-within:scale-x-100"
        />
      </span>
    </label>
  );
}
