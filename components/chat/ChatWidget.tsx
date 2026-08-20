"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * The customer assistant: a launcher pinned bottom-right, and the panel it
 * opens.
 *
 * Deliberately below the cart drawer in the stacking order (z-45/z-55 against
 * its z-60/z-70). Both are bottom-right overlays and the cart is the one
 * carrying a purchase, so when they collide the cart wins.
 */

type Message = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hello. I can help with products, delivery, payment and Sangu, or check on an order for you. What do you need?";

/** Paths that get their own shell and should never show a shop widget. */
const HIDDEN_PREFIXES = ["/dashboard", "/fx", "/maintenance", "/invoice"];

/**
 * Renders the assistant's text.
 *
 * The model is told to link products as markdown, so markdown links are the
 * one construct worth understanding; everything else is shown literally. This
 * is intentionally not a markdown library. The only thing being parsed is text
 * this app's own prompt asked for, the link target is checked to be a relative
 * path before it becomes an anchor, and a full renderer would be a much larger
 * surface for turning model output into markup.
 *
 * The target must start with a single slash. `(?!\/)` is what makes that
 * "a path on this site" rather than merely "starts with a slash": //evil.com
 * is a protocol-relative URL, and without the guard a model that had been
 * talked into emitting one would render a link off the shop.
 */
export const LINK_PATTERN = /\[([^\]]+)\]\((\/(?!\/)[A-Za-z0-9\-._~/?#[\]@!$&()*+,;=%]*)\)/g;

function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const pattern = new RegExp(LINK_PATTERN.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link
        key={m.index}
        href={m[2]}
        className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
      >
        {m[1]}
      </Link>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Escape closes, matching every other overlay on the site.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Abandoning the page mid-answer should stop the request, not leave it
  // streaming into a component that no longer exists.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The assistant is unavailable right now.");
      }

      // Open an empty assistant turn, then fill it as deltas arrive.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendToLast = (delta: string) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: copy[copy.length - 1].content + delta,
          };
          return copy;
        });

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; a partial frame stays in
        // the buffer until the rest of it arrives.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const raw = /^data: (.+)$/m.exec(frame)?.[1];
          if (!event || !raw) continue;

          let data: { delta?: string; message?: string };
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event === "text" && data.delta) appendToLast(data.delta);
          else if (event === "error") setError(data.message ?? "Something went wrong.");
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      // Drop the empty assistant bubble so a failure does not leave a blank one.
      setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, messages]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const shown = messages.length > 0 ? messages : [{ role: "assistant" as const, content: GREETING }];

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close assistant" : "Ask a question"}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-ink text-gold shadow-lg transition-all duration-200 hover:border-gold hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:bottom-8 md:right-8"
      >
        {isOpen ? (
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden="true">
            <path
              d="M3.5 4.5h13v9h-7l-4 3v-3h-2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Atoreum MV assistant"
        aria-hidden={!isOpen}
        // inert keeps the contents out of the tab order while closed; aria-hidden
        // alone still leaves them keyboard-reachable. Same treatment as CartDrawer.
        inert={!isOpen}
        className={`fixed bottom-24 right-5 z-[55] flex max-h-[70vh] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-ink shadow-2xl transition-all duration-200 sm:w-[380px] md:bottom-28 md:right-8 ${
          isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-base text-ivory">Atoreum MV</p>
            <p className="mt-0.5 text-[11px] text-ivory-dim">Ask about products, delivery or an order</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close assistant"
            className="text-ivory-dim transition-colors hover:text-ivory"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
          {shown.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-gold-deep text-ink" : "border border-line text-ivory-dim"
                }`}
              >
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              </div>
            </div>
          ))}

          {busy && shown.at(-1)?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-lg border border-line px-3.5 py-3" aria-label="Typing">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-ivory-dim"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-[11px] leading-relaxed text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask a question"
              aria-label="Your message"
              maxLength={2000}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-md border border-line bg-transparent px-3 py-2.5 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || input.trim().length === 0}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gold-deep text-ink transition-opacity hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path d="M3 10l14-6-6 14-2-6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-ivory-dim/60">
            Answers can be wrong. For anything important, ask us directly.
          </p>
        </div>
      </div>
    </>
  );
}
