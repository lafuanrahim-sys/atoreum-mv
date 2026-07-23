import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Contact-form messages — submitted from /contact, read and managed in
 * Dashboard → Messages.
 *
 * Same Supabase-swappable pattern as the other stores: JSON-on-disk,
 * server-only, auto-created, all access through the exported functions so
 * a later migration touches only this file. Contains customer PII —
 * data/messages.json is gitignored.
 */

const DATA_PATH = path.join(process.cwd(), "data", "messages.json");

export type MessageStatus = "unread" | "read";

export type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
};

function readAll(): ContactMessage[] {
  if (!fs.existsSync(DATA_PATH)) {
    writeAll([]);
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as ContactMessage[];
}

function writeAll(messages: ContactMessage[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(messages, null, 2) + "\n", "utf-8");
}

export function listMessages(): ContactMessage[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countUnreadMessages(): number {
  return readAll().filter((m) => m.status === "unread").length;
}

export function createMessage(params: {
  name: string;
  phone: string;
  message: string;
}): ContactMessage {
  const all = readAll();
  const message: ContactMessage = {
    id: `msg-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    name: params.name.trim().slice(0, 120),
    phone: params.phone.trim().slice(0, 40),
    message: params.message.trim().slice(0, 2000),
    status: "unread",
    createdAt: new Date().toISOString(),
  };
  all.push(message);
  writeAll(all);
  return message;
}

export function setMessageStatus(id: string, status: MessageStatus): ContactMessage | null {
  const all = readAll();
  const index = all.findIndex((m) => m.id === id);
  if (index === -1) return null;
  all[index] = { ...all[index], status };
  writeAll(all);
  return all[index];
}

export function deleteMessage(id: string): boolean {
  const all = readAll();
  const next = all.filter((m) => m.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}
