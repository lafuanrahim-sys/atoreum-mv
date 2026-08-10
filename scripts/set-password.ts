import readline from "node:readline";
import { pool } from "@/lib/db";
import { setPasswordForRecovery, verifyCredentials } from "@/lib/data/users.server";

/**
 * Sets (or tests) an account's password from the terminal, for the case the
 * normal "Forgot password?" flow can't help — the owner account's address
 * isn't a real mailbox, so a reset link has nowhere to arrive.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-password.ts sales@aranzo.co
 *   npx tsx --env-file=.env.production.local scripts/set-password.ts sales@aranzo.co --check
 *   npx tsx --env-file=.env.local            scripts/set-password.ts sales@aranzo.co
 *
 * The database it writes to is whichever DATABASE_URL the --env-file
 * supplies, so the env file you pass IS the choice of production vs local.
 * It prints the host it is about to modify and confirms before touching
 * anything, and prints the host again afterwards.
 *
 *   --check  Test a password against what's stored. Changes nothing.
 *   --show   Echo the password as you type it. Only for when masking
 *            misbehaves in a particular terminal — the password WILL be
 *            visible on screen and in scrollback.
 *
 * The password is always typed, never passed as an argument or environment
 * variable, since both leak into shell history and process listings.
 */

/**
 * Reads a line from the terminal without echoing it.
 *
 * Deliberately does NOT go through readline. Two readline-based attempts
 * failed in ways worth recording, because both looked correct:
 *
 *   1. Overriding _writeToOutput to suppress only writes that did not
 *      contain the prompt. In terminal mode readline repaints the WHOLE
 *      line (prompt + typed text) on every keystroke, and that repaint
 *      contains the prompt — so the password was echoed in clear text.
 *   2. Writing the prompt manually and muting every readline write. The
 *      prompt was then erased by readline's own line handling before it
 *      could be read, leaving the script apparently hung at a blank cursor
 *      while it was in fact waiting for input. Moving the prompt to stderr
 *      did not reliably survive it either.
 *
 * Reading raw keystrokes removes readline from the password path entirely,
 * so exactly what is written to the screen is what this function writes:
 * the prompt, and nothing else.
 */
function hidden(query: string, echo = false): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buffer = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        // Enter — done.
        if (ch === "\r" || ch === "\n") {
          stdin.removeListener("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(buffer);
          return;
        }
        // Ctrl+C — raw mode swallows the usual SIGINT, so handle it here or
        // the terminal is left un-cancellable.
        if (ch === "") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        // Backspace / Delete.
        if (ch === "" || ch === "\b") {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            if (echo) process.stdout.write("\b \b");
          }
          continue;
        }
        // Ignore every other control character (arrow keys arrive as escape
        // sequences, and letting those into the buffer would store a
        // password nobody could ever type again).
        if (ch < " ") continue;
        buffer += ch;
        if (echo) process.stdout.write(ch);
      }
    };
    stdin.on("data", onData);
  });
}

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

/** Host only — never the password or the full connection string. */
function describeTarget(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(url);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    return `${u.hostname}${u.port ? `:${u.port}` : ""}  (${local ? "LOCAL" : "REMOTE — likely production"})`;
  } catch {
    return "unknown (DATABASE_URL is not set or unparseable)";
  }
}

async function main() {
  const email = process.argv[2];
  const checkOnly = process.argv.includes("--check");
  const echo = process.argv.includes("--show");

  if (!email || email.startsWith("--")) {
    console.error("Usage: npx tsx --env-file=<env> scripts/set-password.ts <email> [--check] [--show]");
    console.error("  --check  test a password against what's stored, without changing anything");
    console.error("  --show   echo the password as you type (visible on screen; use only if masking misbehaves)");
    process.exit(1);
  }

  // Refuse to run with piped/redirected stdin: raw-mode reading needs a real
  // terminal, and a piped password came from somewhere that already recorded
  // it (shell history, a file, a CI log).
  if (!process.stdin.isTTY) {
    console.error(
      "This script must be run interactively in a terminal so the password can be typed.\n" +
        "Run it directly rather than piping input into it."
    );
    process.exit(1);
  }

  const { rows } = await pool().query<{ name: string; role: string }>(
    "select name, role from users where lower(email) = $1",
    [email.trim().toLowerCase()]
  );
  if (!rows[0]) {
    console.error(`No account found for ${email} on ${describeTarget()}.`);
    process.exit(1);
  }

  console.log(`\nAccount : ${rows[0].name} <${email}>  [${rows[0].role}]`);
  console.log(`Database: ${describeTarget()}`);
  if (echo) console.log("NOTE    : --show is on, so what you type will be visible on screen.");
  console.log("");

  // Read-only diagnostic: does the stored hash match what you type? Splits
  // "the password was saved as something else" from "the password is right
  // but something else is refusing the login".
  if (checkOnly) {
    const candidate = await hidden("Password to test: ", echo);
    if (candidate.length === 0) {
      console.error("Nothing entered. Nothing checked.");
      process.exit(1);
    }
    const user = await verifyCredentials(email, candidate);
    console.log(
      user
        ? `\nMATCH — this is the password stored on ${describeTarget()}.`
        : `\nNO MATCH — the stored password on ${describeTarget()} is something else.` +
            `\n(You typed ${candidate.length} character(s).)`
    );
    return;
  }

  const confirm = await ask("Change this account's password? (yes/no) ");
  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled. Nothing changed.");
    return;
  }

  const first = await hidden("New password (min 8 characters): ", echo);
  if (first.length < 8) {
    console.error(`Too short (${first.length} character(s)). Nothing changed.`);
    process.exit(1);
  }
  const second = await hidden("Type it again: ", echo);
  if (first !== second) {
    console.error("Those didn't match. Nothing changed.");
    process.exit(1);
  }

  const result = await setPasswordForRecovery(email, first);
  if ("error" in result) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(`\nDone — ${result.name} can now sign in at /login with the new password.`);
  console.log(`Changed on: ${describeTarget()}`);
  console.log(`Password length set: ${first.length} characters.`);
  console.log("Existing sessions are unaffected; they expire on their own.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
