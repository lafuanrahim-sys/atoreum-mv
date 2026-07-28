import crypto from "crypto";
import { pool } from "@/lib/db";

/**
 * Postgres-backed contact-message store (see lib/data/schema.sql) —
 * replaces the original JSON-on-disk version, which didn't persist on
 * Vercel's read-only/ephemeral serverless filesystem. Same exported
 * functions as before (now async).
 *
 * Contact-form messages — submitted from /contact, read and managed in
 * Dashboard → Messages.
 */

export type MessageStatus = "unread" | "read" | "archived";

export type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
};

type MessageRow = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: MessageStatus;
  created_at: string;
};

function rowToMessage(row: MessageRow): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listMessages(): Promise<ContactMessage[]> {
  const { rows } = await pool().query<MessageRow>("select * from messages order by created_at desc");
  return rows.map(rowToMessage);
}

export async function countUnreadMessages(): Promise<number> {
  const { rows } = await pool().query<{ count: string }>(
    "select count(*)::text as count from messages where status = 'unread'"
  );
  return Number(rows[0]?.count ?? 0);
}

export async function createMessage(params: {
  name: string;
  phone: string;
  message: string;
}): Promise<ContactMessage> {
  const id = `msg-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const { rows } = await pool().query<MessageRow>(
    `insert into messages (id, name, phone, message, status)
     values ($1, $2, $3, $4, 'unread')
     returning *`,
    [id, params.name.trim().slice(0, 120), params.phone.trim().slice(0, 40), params.message.trim().slice(0, 2000)]
  );
  return rowToMessage(rows[0]);
}

export async function setMessageStatus(id: string, status: MessageStatus): Promise<ContactMessage | null> {
  const { rows } = await pool().query<MessageRow>(
    "update messages set status = $2 where id = $1 returning *",
    [id, status]
  );
  return rows[0] ? rowToMessage(rows[0]) : null;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const { rowCount } = await pool().query("delete from messages where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
