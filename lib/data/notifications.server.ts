import { pool } from "@/lib/db";
import { maleDateString } from "@/lib/boli/diveEngine";

/**
 * Whether a customer has something waiting they have not seen.
 *
 * Derived, not stored. Orders already record when they changed, the Sangu
 * ledger already timestamps every credit, and the dive already knows whether
 * today's play has happened — so "is there anything new" is a question about
 * data the shop keeps anyway, against one column recording when this customer
 * last looked at their profile.
 *
 * Writing a notifications row on every event would mean each order status
 * change and each Sangu credit taking on a second write, able to fail on its
 * own, to store something the first write already implies.
 *
 * Signed-in customers only. A guest has no account to hang a dot on, and the
 * things worth telling them about reach them by email instead.
 */

export type NotificationState = {
  hasUnseen: boolean;
  /** What is waiting, for the profile page to acknowledge. */
  reasons: string[];
};

export async function getNotificationState(user: {
  id: string;
  email: string;
}): Promise<NotificationState> {
  try {
    const { rows: seenRows } = await pool().query<{ notifications_seen_at: Date | null }>(
      "select notifications_seen_at from users where id = $1",
      [user.id]
    );
    const seenAt = seenRows[0]?.notifications_seen_at ?? null;
    const reasons: string[] = [];

    /**
     * Today's dive.
     *
     * A state rather than an event, so it is judged against the day the
     * customer last looked rather than an instant: opening the profile counts
     * as having been told about today's dive, and tomorrow's raises the dot
     * again. Without that the dot would return the moment the page closed and
     * mean nothing within a week.
     */
    const today = maleDateString(new Date());
    const seenToday = seenAt !== null && maleDateString(seenAt) === today;
    if (!seenToday) {
      const { rows } = await pool().query<{ played: string }>(
        "select count(*)::text as played from boli_dive_plays where user_id = $1 and play_date = $2",
        [user.id, today]
      );
      if (Number(rows[0]?.played ?? 0) === 0) reasons.push("Your daily dive is waiting");
    }

    // Everything below is a genuine event, so it compares against the instant.
    // A customer who has never looked sees whatever is there, which is right:
    // it is all new to them.
    const since = seenAt;

    const { rows: orderRows } = await pool().query<{ n: string }>(
      `select count(*)::text as n
         from orders
        where (user_id = $1 or lower(customer->>'email') = lower($2))
          and status in ('Confirmed', 'Completed')
          and ($3::timestamptz is null or updated_at > $3::timestamptz)`,
      [user.id, user.email, since]
    );
    if (Number(orderRows[0]?.n ?? 0) > 0) reasons.push("An order of yours was updated");

    const { rows: sanguRows } = await pool().query<{ n: string }>(
      `select count(*)::text as n
         from boli_ledger
        where user_id = $1
          and delta > 0
          and ($2::timestamptz is null or created_at > $2::timestamptz)`,
      [user.id, since]
    );
    if (Number(sanguRows[0]?.n ?? 0) > 0) reasons.push("You earned Sangu");

    return { hasUnseen: reasons.length > 0, reasons };
  } catch (err) {
    // A dot is not worth an error page. Silence is the right failure here.
    console.error("[notifications] could not read state:", err);
    return { hasUnseen: false, reasons: [] };
  }
}

/**
 * Mark everything seen. Called when the profile is opened, which is the only
 * place the dot leads, so looking at it is what clears it.
 */
export async function markNotificationsSeen(userId: string): Promise<void> {
  try {
    await pool().query("update users set notifications_seen_at = now() where id = $1", [userId]);
  } catch (err) {
    console.error("[notifications] could not mark seen:", err);
  }
}
