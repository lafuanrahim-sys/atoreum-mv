import Link from "next/link";
import { listMessages } from "@/lib/data/messages.server";
import { deleteMessageAction, setMessageStatusAction } from "@/app/actions/messages";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import PageHeader from "@/components/dashboard/PageHeader";

/**
 * Contact-form inbox: submissions from /contact land here as "unread".
 * Archiving tucks a message away into the Archived tab without deleting it.
 */
export default async function DashboardMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "inbox" } = await searchParams;
  const showArchived = view === "archived";

  const all = listMessages();
  const inbox = all.filter((m) => m.status !== "archived");
  const archived = all.filter((m) => m.status === "archived");
  const messages = showArchived ? archived : inbox;
  const unread = inbox.filter((m) => m.status === "unread").length;

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Inbox"
        title="Messages"
        count={inbox.length}
        description={unread > 0 ? `Notes and suggestions sent from the contact page — ${unread} unread.` : "Notes and suggestions sent from the contact page."}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.15em]">
          {[
            { key: "inbox", label: `Inbox (${inbox.length})`, href: "/dashboard/messages" },
            {
              key: "archived",
              label: `Archived (${archived.length})`,
              href: "/dashboard/messages?view=archived",
            },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`border-b-2 py-2.5 transition-colors ${
                (t.key === "archived") === showArchived
                  ? "border-gold-deep italic text-gold-deep"
                  : "border-transparent text-ivory-dim hover:text-ivory"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {!showArchived && messages.length > 1 && (
          <AdminActionButton
            action={async () => {
              "use server";
              await Promise.all(messages.map((m) => setMessageStatusAction(m.id, "archived")));
            }}
            label={`Archive all (${messages.length})`}
            pendingLabel="Archiving…"
            toastMessage={`${messages.length} messages archived.`}
            className="mb-2"
          />
        )}
      </div>

      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-ivory-dim">
          {showArchived ? "No archived messages." : "No messages yet."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {messages.map((m) => (
            <li key={m.id} className="border-b border-line py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {m.status === "unread" && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep"
                      role="status"
                      aria-label="Unread"
                    />
                  )}
                  <span className="font-display italic text-ivory">{m.name}</span>
                  <a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="font-mono text-gold-deep hover:underline tabular-nums">
                    {m.phone}
                  </a>
                  <span className="font-mono text-xs text-ivory-dim">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {!showArchived && (
                    <AdminActionButton
                      action={async () => {
                        "use server";
                        await setMessageStatusAction(m.id, m.status === "unread" ? "read" : "unread");
                      }}
                      label={m.status === "unread" ? "Mark read" : "Mark unread"}
                      pendingLabel="Updating…"
                      toastMessage={m.status === "unread" ? "Marked as read." : "Marked as unread."}
                    />
                  )}
                  <AdminActionButton
                    action={async () => {
                      "use server";
                      await setMessageStatusAction(m.id, showArchived ? "read" : "archived");
                    }}
                    label={showArchived ? "Unarchive" : "Archive"}
                    pendingLabel="Updating…"
                    toastMessage={showArchived ? "Message moved back to inbox." : "Message archived."}
                  />
                  <AdminActionButton
                    action={async () => {
                      "use server";
                      await deleteMessageAction(m.id);
                    }}
                    label="Delete"
                    pendingLabel="Deleting…"
                    variant="danger"
                    toastMessage="Message deleted."
                    confirmTitle="Delete this message?"
                    confirmMessage="This message will be permanently removed."
                    confirmLabel="Delete"
                  />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ivory-dim">
                {m.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
