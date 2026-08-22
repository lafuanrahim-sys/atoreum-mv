import Link from "next/link";
import { listConversations } from "@/lib/chat/conversations.server";
import PageHeader from "@/components/dashboard/PageHeader";

/**
 * Every conversation the assistant has had, one row each.
 *
 * The unit here is the conversation, not the message: a person arrived, asked
 * some things, maybe got handed to a human, maybe left. That is what is worth
 * scanning. Messages are the detail behind a row, on its own page.
 *
 * Nothing is pruned. Conversations are kept until someone deletes one on
 * purpose, which is why the detail page carries the only delete control.
 */
export const metadata = { title: "Chat history" };

type Filter = "all" | "escalated" | "guests" | "accounts";

export default async function DashboardChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; deleted?: string }>;
}) {
  const { filter: filterParam = "all", deleted } = await searchParams;
  const filter: Filter =
    filterParam === "escalated" ? "escalated" : filterParam === "guests" ? "guests" : filterParam === "accounts" ? "accounts" : "all";

  const all = await listConversations();
  const escalated = all.filter((c) => c.escalated);
  const guests = all.filter((c) => c.who === "Guest");
  const accounts = all.filter((c) => c.who !== "Guest");
  const rows =
    filter === "escalated" ? escalated : filter === "guests" ? guests : filter === "accounts" ? accounts : all;

  const tabs = [
    { key: "all", label: `All (${all.length})`, href: "/dashboard/chats" },
    { key: "escalated", label: `Reached a person (${escalated.length})`, href: "/dashboard/chats?filter=escalated" },
    { key: "guests", label: `Guests (${guests.length})`, href: "/dashboard/chats?filter=guests" },
    { key: "accounts", label: `Accounts (${accounts.length})`, href: "/dashboard/chats?filter=accounts" },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Assistant"
        title="Chat history"
        count={all.length}
        description="Every conversation customers have had with the AI assistant, kept until you delete it."
      />

      {deleted && (
        <p role="status" className="mt-4 border border-line px-4 py-3 font-mono text-[11px] text-emerald-500">
          Conversation deleted.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-6 border-b border-line font-mono text-[11px] uppercase tracking-[0.15em]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`border-b-2 py-2.5 transition-colors ${
              t.key === filter
                ? "border-gold-deep italic text-gold-deep"
                : "border-transparent text-ivory-dim hover:text-ivory"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ivory-dim">
          {all.length === 0
            ? "No conversations yet. They appear here as soon as a customer uses the assistant."
            : "Nothing in this view."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/chats/${c.id}`}
                className="flex flex-col gap-2 py-5 transition-colors hover:bg-ivory/[0.03] sm:flex-row sm:items-baseline sm:gap-5"
              >
                <div className="flex shrink-0 items-baseline gap-3 sm:w-56">
                  <span className="text-sm text-ivory">{c.who}</span>
                  {/* Live presence, because a conversation someone is still
                      watching is the one worth opening first. */}
                  {c.isPresent && (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      Here now
                    </span>
                  )}
                </div>

                <p className="min-w-0 flex-1 truncate text-sm text-ivory-dim">
                  {c.opener || <span className="italic">no message</span>}
                </p>

                <div className="flex shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ivory-dim">
                  {c.escalated && (
                    <span className={c.staffReplyCount > 0 ? "text-gold" : "text-red-400"}>
                      {c.staffReplyCount > 0 ? `Answered (${c.staffReplyCount})` : "Awaiting reply"}
                    </span>
                  )}
                  <span className="tabular-nums">{c.messageCount} msg</span>
                  <span className="w-24 text-right tabular-nums">{c.lastActivityLabel}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
