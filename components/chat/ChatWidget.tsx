"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCart, type CartLine } from "@/lib/cart/CartContext";

/**
 * The customer assistant: a launcher pinned bottom-right, and the panel it
 * opens.
 *
 * Deliberately below the cart drawer in the stacking order (z-45/z-55 against
 * its z-60/z-70). Both are bottom-right overlays and the cart is the one
 * carrying a purchase, so when they collide the cart wins.
 */

type Message = { role: "user" | "assistant" | "staff"; content: string };

const GREETING = "Hello. I'm the Atoreum MV assistant, an AI. What can I help you with?";

/**
 * The way in.
 *
 * A blank box asking "how can I help?" is the worst opening a shop assistant
 * can offer: the customer has to guess what it is capable of, and most people
 * guess low and close it. Four buttons say what it does in the act of asking,
 * and every one of them lands on something it handles well.
 *
 * Typing is held back until one is chosen, so the first message is never a
 * shot in the dark.
 *
 * "Talk to a person" is worded to be unmistakable next to the other three,
 * because the difference between an AI and a colleague is the one thing a
 * customer should never have to work out for themselves.
 */
const OPENERS = [
  { label: "Help me choose a product", send: "I'd like help finding the right products for my skin." },
  { label: "Delivery & payment", send: "How does delivery and payment work?" },
  { label: "Where's my order?", send: "Where is my order?" },
  { label: "Talk to a person", send: "I'd like to speak to someone from the team, not the AI assistant." },
] as const;

/** Paths that get their own shell and should never show a shop widget. */
const HIDDEN_PREFIXES = ["/dashboard", "/fx", "/maintenance", "/invoice"];

/** Where the in-progress conversation is held between page loads. */
const STORAGE_KEY = "atoreum-chat-session";

/* -------------------------------------------------------------------------
 * Session store
 *
 * The conversation has to survive a refresh and follow the customer between
 * pages, and die when the browser closes. sessionStorage does all three.
 *
 * It is read through useSyncExternalStore rather than an effect for the same
 * reason the cart is (lib/cart/CartContext.tsx): the server renders an empty
 * panel while the browser may have a conversation to restore, and
 * getServerSnapshot is what lets those two disagree without a hydration
 * mismatch. Restoring in an effect would also show a flash of the greeting
 * before the real conversation replaced it.
 * ---------------------------------------------------------------------- */

type ChatState = {
  messages: Message[];
  isOpen: boolean;
  /**
   * The newest staff message this browser has shown, as an ISO timestamp.
   *
   * Persisted alongside the conversation so a refresh resumes from the right
   * point. It also has to survive being ABSENT correctly: a fresh
   * sessionStorage with a live cookie still attached to an old conversation
   * must not poll from the beginning of time, or every reply ever sent
   * reappears in an empty panel as though it had just arrived. See how this
   * is seeded on first render below.
   */
  lastStaffAt: string | null;
  /**
   * Ids of staff messages already displayed.
   *
   * The poll also passes a "since" cursor, but a cursor is an optimisation and
   * this is the guarantee. Anything that resets it -- a remount, a second tab,
   * an effect re-running as `busy` flips -- re-fetches messages already on
   * screen, and the customer watches the same reply pile up four times.
   * Identity cannot drift the way a timestamp can.
   *
   * Persisted with the conversation so a reload does not replay the thread.
   */
  seenStaffIds: string[];
};

const EMPTY_STATE: ChatState = { messages: [], isOpen: false, seenStaffIds: [], lastStaffAt: null };

let state: ChatState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function readPersisted(): ChatState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const saved = JSON.parse(raw) as Partial<ChatState>;
    return {
      messages: Array.isArray(saved.messages) ? saved.messages : [],
      isOpen: Boolean(saved.isOpen),
      seenStaffIds: Array.isArray(saved.seenStaffIds) ? saved.seenStaffIds : [],
      lastStaffAt: typeof saved.lastStaffAt === "string" ? saved.lastStaffAt : null,
    };
  } catch {
    // Corrupt, or a private mode that throws on access. Start fresh.
    return EMPTY_STATE;
  }
}

function persist(next: ChatState) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked. The chat still works for this page.
  }
}

function setState(update: (prev: ChatState) => ChatState) {
  state = update(state);
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  // The first subscriber past hydration pulls in what was persisted and
  // notifies, because mutating `state` alone does not re-render.
  if (!hydrated) {
    hydrated = true;
    state = readPersisted();
    // Nothing restored, yet the cookie may still point at a conversation from
    // a tab that was closed. Start the cursor at now, so replies that predate
    // this panel stay in the past where the customer left them.
    if (state.messages.length === 0 && !state.lastStaffAt) {
      state = { ...state, lastStaffAt: new Date().toISOString() };
    }
    callback();
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY_STATE;

/* ---------------------------------------------------------------------- */

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
  const { addItem, lines } = useCart();
  const { messages, isOpen } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Draft text and in-flight status are per-tab and worthless after a reload,
  // so unlike the conversation they stay outside the session store.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const started = messages.length > 0;
  const setOpen = (open: boolean) => setState((prev) => ({ ...prev, isOpen: open }));

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    // Only once the conversation has started; before that the buttons are the
    // interface, and focusing a disabled box would be misleading.
    if (isOpen && started) inputRef.current?.focus();
  }, [isOpen, started]);

  // Escape closes, matching every other overlay on the site.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState((prev) => ({ ...prev, isOpen: false }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Abandoning the page mid-answer should stop the request, not leave it
  // streaming into a component that no longer exists.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Watch for replies from a person.
   *
   * Only while the panel is open, and never mid-answer: the streaming code
   * appends to whatever message is last, so a staff reply landing in the
   * middle of it would be written into the assistant's bubble.
   *
   * Eight seconds because the shop replies in minutes, not milliseconds. Two
   * people also doing the deliveries are not sitting at a chat desk, and a
   * tighter interval would only add load to say "still nothing".
   */
  useEffect(() => {
    if (!isOpen || busy || !started) return;
    let cancelled = false;

    const poll = async () => {
      try {
        // Read from the store, not a ref: a ref resets on every mount, and a
        // mount with a live cookie is exactly when replaying the whole thread
        // would be most confusing.
        const since = state.lastStaffAt;
        const res = await fetch(`/api/chat/poll${since ? `?since=${encodeURIComponent(since)}` : ""}`);
        if (!res.ok || cancelled) return;
        const { messages: incoming } = (await res.json()) as {
          messages: { id: string; content: string; createdAt: string }[];
        };
        if (cancelled || incoming.length === 0) return;

        setState((prev) => {
          // Identity, not timing, decides what is new.
          const seen = new Set(prev.seenStaffIds);
          const fresh = incoming.filter((i) => !seen.has(i.id));
          if (fresh.length === 0) return prev;

          return {
            ...prev,
            messages: [
              ...prev.messages,
              ...fresh.map((i) => ({ role: "staff" as const, content: i.content })),
            ],
            // Bounded: a conversation nobody will scroll back through does not
            // need an unbounded list of ids following it around sessionStorage.
            seenStaffIds: [...prev.seenStaffIds, ...fresh.map((i) => i.id)].slice(-200),
            lastStaffAt: incoming[incoming.length - 1].createdAt,
          };
        });
      } catch {
        // A failed poll is not worth telling the customer about; the next one
        // is eight seconds away.
      }
    };

    void poll();
    const timer = setInterval(poll, 8_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, busy, started]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;

      busyRef.current = true;
      setBusy(true);
      setError("");

      const outgoing = [...state.messages, { role: "user" as const, content: trimmed }];
      setState((prev) => ({ ...prev, messages: [...prev.messages, { role: "user", content: trimmed }] }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Staff turns are the shop's own words. Sending them as the
            // assistant's would have the model treat a colleague's promise as
            // something it said itself, so they are left out.
            messages: outgoing
              .filter((m) => m.role !== "staff")
              .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
            // The basket lives in this browser and nowhere else, so the server
            // cannot look it up; it has to be told. Sent as ids and quantities
            // only -- the prices come from the catalogue server-side, so a
            // tampered payload changes what the assistant discusses and never
            // what anything costs.
            cart: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "The assistant is unavailable right now.");
        }

        // Open an empty assistant turn, then fill it as deltas arrive.
        setState((prev) => ({ ...prev, messages: [...prev.messages, { role: "assistant", content: "" }] }));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const appendToLast = (delta: string) =>
          setState((prev) => {
            const copy = [...prev.messages];
            copy[copy.length - 1] = {
              role: "assistant",
              content: copy[copy.length - 1].content + delta,
            };
            return { ...prev, messages: copy };
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

            let data: { delta?: string; message?: string; line?: CartLine };
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }

            if (event === "text" && data.delta) appendToLast(data.delta);
            else if (event === "cart" && data.line) {
              // The server has already checked the product exists and is in
              // stock; this is the half only the browser can do.
              const { quantity, ...item } = data.line;
              addItem(item, quantity);
            } else if (event === "error") setError(data.message ?? "Something went wrong.");
          }
        }
        // A stream that said nothing leaves the placeholder bubble behind.
        // That happens by design when a colleague is already handling the
        // conversation and the assistant has nothing to add.
        setState((prev) => {
          const last = prev.messages.at(-1);
          return last?.role === "assistant" && !last.content
            ? { ...prev, messages: prev.messages.slice(0, -1) }
            : prev;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        // Drop the empty assistant bubble so a failure does not leave a blank one.
        setState((prev) => {
          const last = prev.messages.at(-1);
          return last?.role === "assistant" && !last.content
            ? { ...prev, messages: prev.messages.slice(0, -1) }
            : prev;
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
        abortRef.current = null;
      }
    },
    [addItem, lines]
  );

  const sendFromInput = () => {
    const el = inputRef.current;
    if (!el) return;
    const text = el.value;
    el.value = "";
    void send(text);
  };

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const shown: Message[] = started ? messages : [{ role: "assistant", content: GREETING }];

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-label={isOpen ? "Close assistant" : "Ask a question"}
        aria-expanded={isOpen}
        className="chat-press fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-ink-2/75 text-gold backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:bottom-8 md:right-8"
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
        // Glass, and the same glass the cart drawer already uses: ink-2 at 75%,
        // a diagonal white wash that fades by halfway, blur and a little
        // saturation. Flat bg-ink read as a black rectangle stuck on the page,
        // which is the one thing a panel floating above content should not do.
        //
        // The inset ring is the debossing: a hairline highlight along the top
        // edge and a soft dark bloom below it, so the surface reads as pressed
        // into the page rather than laid on top of it.
        // Inset only. The outer drop shadow was a dark bloom cast onto an
        // already-dark page: it read as a smudge around the panel rather than
        // as elevation, which is what a shadow is for. The glass and the
        // hairline edge do that job here, and they do it without muddying the
        // background behind them.
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.35)",
        }}
        // data-open drives the entrance; the geometry and easing live in
        // globals.css so the stagger and the reduced-motion fallback can be
        // expressed properly rather than squeezed into utility classes.
        data-open={isOpen}
        className={`chat-panel fixed bottom-24 right-5 z-[55] flex max-h-[70vh] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ivory/15 bg-ink-2/88 bg-[linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0)_55%)] backdrop-blur-2xl backdrop-saturate-150 sm:w-[380px] md:bottom-28 md:right-8 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <header className="flex items-center justify-between border-b border-ivory/10 bg-ink/45 px-5 py-4">
          <div>
            <p className="font-display text-base text-ivory">Atoreum MV</p>
            <p className="mt-0.5 text-[11px] text-ivory/85">AI assistant, with a person a click away</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            // The glyph stays 16px; the BUTTON is 44 square. A 16px hit area
            // is a miss waiting to happen on a phone, and negative margin
            // keeps the larger target from pushing the header out of shape.
            className="chat-press -m-2.5 flex h-11 w-11 items-center justify-center rounded-full text-ivory-dim transition-colors hover:bg-ivory/10 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5"
          aria-live="polite"
          // Lenis drives the page scroll by swallowing wheel events at the
          // window, which leaves any nested scroller dead to the mouse wheel.
          // This is how you tell it to keep its hands off one element.
          data-lenis-prevent
        >
          {shown.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
              {/* Attributed, because a customer who asked for a person needs to
                  see that they got one. */}
              {m.role === "staff" && (
                <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-gold">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                  Customer Support
                </p>
              )}
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold-deep text-ink"
                    : m.role === "staff"
                      ? "border border-gold/30 bg-gold/5 text-ivory"
                      : "border border-ivory/12 bg-ink/45 text-ivory/85"
                }`}
              >
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              </div>
            </div>
          ))}

          {/* The way in. Replaced by the conversation once one exists. */}
          {!started && (
            <div className="flex flex-col items-start gap-2 pt-1">
              {OPENERS.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => void send(o.send)}
                  // 45ms apart: inside the 30-50ms band that reads as one
                  // gesture rather than four separate arrivals.
                  style={{ animationDelay: `${180 + i * 45}ms` }}
                  className="chat-opener chat-press min-h-11 w-full rounded-lg border border-ivory/12 bg-ivory/[0.03] px-3.5 py-2.5 text-left text-sm text-ivory transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {busy && shown.at(-1)?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-lg border border-ivory/10 bg-ivory/[0.04] px-3.5 py-3" aria-label="Typing">
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

        <div className="border-t border-ivory/10 bg-ink/45 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              // Held back until an opener is picked, so the first message is
              // always something the assistant is known to handle.
              disabled={!started}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendFromInput();
                }
              }}
              placeholder={started ? "Ask a question" : "Choose one above to start"}
              aria-label="Your message"
              maxLength={2000}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-ivory/12 bg-ink/40 px-3 py-2.5 text-sm text-ivory placeholder:text-ivory-dim/60 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              disabled={busy || !started}
              onClick={sendFromInput}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gold-deep text-ink transition-opacity hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path d="M3 10l14-6-6 14-2-6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-ivory/90">
            AI assistant. Answers can be wrong; for anything important, ask us directly.
          </p>
        </div>
      </div>
    </>
  );
}
