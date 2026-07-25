import Link from "next/link";
import { listMessages } from "@/lib/data/messages.server";
import { deleteMessageAction, setMessageStatusAction } from "@/app/actions/messages";

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
      <h1 className="font-display text-2xl text-ivory">Messages ({inbox.length})</h1>
      <p className="mt-1 text-sm text-ivory-dim">
        Notes and suggestions sent from the contact page
        {unread > 0 ? ` — ${unread} unread.` : "."}
      </p>

      <div className="mt-6 flex gap-1 border-b border-line text-xs uppercase tracking-[0.15em]">
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
            className={`px-4 py-2 transition-colors ${
              (t.key === "archived") === showArchived
                ? "border-b-2 border-gold text-gold"
                : "text-ivory-dim hover:text-gold"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-ivory-dim">
          {showArchived ? "No archived messages." : "No messages yet."}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border bg-ink p-5 ${
                m.status === "unread" ? "border-gold/50" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {m.status === "unread" && (
                    <span
                      className="h-2 w-2 rounded-full bg-gold"
                      role="status"
                      aria-label="Unread"
                    />
                  )}
                  <span className="text-ivory">{m.name}</span>
                  <a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="text-gold hover:underline tabular-nums">
                    {m.phone}
                  </a>
                  <span className="text-xs text-ivory-dim">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {!showArchived && (
                    <form
                      action={async () => {
                        "use server";
                        await setMessageStatusAction(m.id, m.status === "unread" ? "read" : "unread");
                      }}
                    >
                      <button
                        type="submit"
                        className="text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-gold"
                      >
                        {m.status === "unread" ? "Mark read" : "Mark unread"}
                      </button>
                    </form>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await setMessageStatusAction(m.id, showArchived ? "read" : "archived");
                    }}
                  >
                    <button
                      type="submit"
                      className="text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-gold"
                    >
                      {showArchived ? "Unarchive" : "Archive"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await deleteMessageAction(m.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-[11px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:text-red-400"
                    >
                      Delete
                    </button>
                  </form>
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
