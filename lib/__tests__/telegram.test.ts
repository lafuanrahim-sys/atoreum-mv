import { describe, it, expect } from "vitest";
import { parseChatIds, escapeTelegramHtml } from "@/lib/telegram";

/**
 * parseChatIds decides who gets told an order came in, so the cases that
 * matter are the ones where a hand-edited env var is slightly malformed. An
 * empty string reaching the API as a chat_id is a 400 and a silently missed
 * notification, which is the failure this is guarding.
 */
describe("parseChatIds", () => {
  it("reads a single id", () => {
    expect(parseChatIds("7022531899")).toEqual(["7022531899"]);
  });

  it("reads a list, including a group's negative id", () => {
    expect(parseChatIds("7022531899,-1001234567890")).toEqual(["7022531899", "-1001234567890"]);
  });

  it("tolerates spaces around the separators", () => {
    expect(parseChatIds(" 111 ,  222 ")).toEqual(["111", "222"]);
  });

  it("drops the empty entry a trailing comma leaves behind", () => {
    expect(parseChatIds("111,")).toEqual(["111"]);
    expect(parseChatIds("111,,222")).toEqual(["111", "222"]);
  });

  it("treats unset and blank as nobody configured", () => {
    expect(parseChatIds(undefined)).toEqual([]);
    expect(parseChatIds("")).toEqual([]);
    expect(parseChatIds("   ")).toEqual([]);
  });
});

describe("escapeTelegramHtml", () => {
  it("escapes the characters that would make Telegram reject the message", () => {
    expect(escapeTelegramHtml("Tom & Jerry <b>")).toBe("Tom &amp; Jerry &lt;b&gt;");
  });

  it("escapes the ampersand first, so an escape is not double-escaped", () => {
    expect(escapeTelegramHtml("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });
});
