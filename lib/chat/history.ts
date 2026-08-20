/**
 * Normalising what the browser claims the conversation was.
 *
 * The widget posts the whole history back on every turn, which means the
 * history is user input and not a record of anything. A caller can rewrite
 * past assistant turns, invent roles, or paste a megabyte into one message.
 * None of that is a security problem by itself -- the model has no authority,
 * and the tools take no identity argument -- but all of it costs tokens, so it
 * is bounded here before it reaches the API.
 */

export type ClientMessage = { role: "user" | "assistant"; content: string };

export const MAX_MESSAGE_CHARS = 2_000;
export const MAX_HISTORY_TURNS = 20;

export function sanitiseHistory(raw: unknown): ClientMessage[] {
  if (!Array.isArray(raw)) return [];

  const out: ClientMessage[] = [];
  for (const m of raw.slice(-MAX_HISTORY_TURNS * 2)) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as Partial<ClientMessage>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }

  // The API requires the first message to be from the user, and rejects two
  // messages from the same role in a row. Both are trivial for a caller to
  // violate, so both are fixed here rather than returned as an error.
  while (out.length && out[0].role !== "user") out.shift();

  const collapsed: ClientMessage[] = [];
  for (const m of out) {
    const prev = collapsed.at(-1);
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`;
    else collapsed.push({ ...m });
  }

  // A trailing assistant turn would ask the model to continue its own
  // sentence rather than answer anything.
  while (collapsed.length && collapsed.at(-1)!.role !== "user") collapsed.pop();

  return collapsed;
}
