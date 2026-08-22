import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversation, STAFF_DISPLAY_NAME } from "@/lib/chat/conversations.server";
import { deleteConversationAction } from "@/app/actions/chats";
import PageHeader from "@/components/dashboard/PageHeader";
import AdminActionButton from "@/components/dashboard/AdminActionButton";

/**
 * One conversation in full.
 *
 * Laid out as a transcript rather than a table, because that is what it is:
 * the point of opening this page is to read what was actually said, in order,
 * and see where a colleague stepped in.
 *
 * Staff turns are labelled with the real name here, unlike the customer's own
 * window where everyone is "Customer Support". Inside the dashboard, knowing
 * which of two people answered is exactly the useful part.
 */
export const metadata = { title: "Conversation" };

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const { summary, messages } = conversation;

  const facts = [
    ["Customer", summary.who],
    ["Email", summary.email ?? "—"],
    ["Contact given", summary.contact || "—"],
    ["Started", when(summary.startedAt)],
    ["Last activity", when(summary.lastActivityAt)],
    ["Answering", summary.mode === "human" ? "A person" : "The assistant"],
    ["Reached a person", summary.escalated ? `Yes, ${summary.staffReplyCount} repl${summary.staffReplyCount === 1 ? "y" : "ies"}` : "No"],
  ] as const;

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/chats"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-gold"
      >
        &larr; Chat history
      </Link>

      <PageHeader
        eyebrow="Conversation"
        title={summary.who}
        count={messages.length}
        description={`${messages.length} message${messages.length === 1 ? "" : "s"}, last active ${when(summary.lastActivityAt)}.`}
      />

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border-y border-line py-5 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">{label}</dt>
            <dd className="text-right text-sm text-ivory">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-5">
        {messages.length === 0 && (
          <p className="text-sm text-ivory-dim">This conversation has no messages.</p>
        )}

        {messages.map((m) => {
          const isCustomer = m.role === "customer";
          const isStaff = m.role === "staff";
          return (
            <div key={m.id} className={isCustomer ? "flex flex-col items-end" : "flex flex-col items-start"}>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ivory-dim">
                {isCustomer
                  ? summary.who
                  : isStaff
                    ? `${STAFF_DISPLAY_NAME}${m.staffName ? ` · ${m.staffName}` : ""}`
                    : "Assistant"}
                <span className="ml-2 text-ivory-dim/60">{when(m.createdAt)}</span>
              </p>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  isCustomer
                    ? "bg-gold-deep/90 text-ink"
                    : isStaff
                      ? "border border-gold/30 bg-gold/5 text-ivory"
                      : "border border-line text-ivory-dim"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* The only thing that removes a conversation. No archive, no undo:
          someone deleting one is usually doing it because it holds a phone
          number or a complaint that has been settled and need not be kept. */}
      <div className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-[11px] leading-relaxed text-ivory-dim">
          Conversations are kept until deleted. This cannot be undone.
        </p>
        <AdminActionButton
          action={async () => {
            "use server";
            await deleteConversationAction(id);
          }}
          label="Delete conversation"
          pendingLabel="Deleting…"
          toastMessage="Conversation deleted."
          confirmMessage="Delete this conversation permanently? This cannot be undone."
        />
      </div>
    </div>
  );
}
