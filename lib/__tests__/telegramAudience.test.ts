import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { allConfiguredChatIds } from "@/lib/telegram";

/**
 * Which group each kind of message goes to.
 *
 * The property that matters most is the fallback: a shop that has not set up a
 * second group must keep receiving its customer escalations in the group it
 * already reads. Splitting the channels is an improvement to opt into, never a
 * configuration step you can fail and lose messages by failing.
 */
describe("telegram audiences", () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.TELEGRAM_ORDER_CHAT_ID;
    delete process.env.TELEGRAM_SUPPORT_CHAT_ID;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("accepts replies from both groups", () => {
    process.env.TELEGRAM_ORDER_CHAT_ID = "-100";
    process.env.TELEGRAM_SUPPORT_CHAT_ID = "-200";
    expect(allConfiguredChatIds().sort()).toEqual(["-100", "-200"]);
  });

  it("does not list a group twice when both point at the same chat", () => {
    process.env.TELEGRAM_ORDER_CHAT_ID = "-100";
    process.env.TELEGRAM_SUPPORT_CHAT_ID = "-100";
    expect(allConfiguredChatIds()).toEqual(["-100"]);
  });

  it("falls back to the order group when no support group is set", () => {
    // The load-bearing case: without this, a shop that never configures
    // TELEGRAM_SUPPORT_CHAT_ID silently stops receiving escalations.
    process.env.TELEGRAM_ORDER_CHAT_ID = "-100";
    expect(allConfiguredChatIds()).toEqual(["-100"]);
  });

  it("handles several chats per group", () => {
    process.env.TELEGRAM_ORDER_CHAT_ID = "-100, -101";
    process.env.TELEGRAM_SUPPORT_CHAT_ID = "-200";
    expect(allConfiguredChatIds().sort()).toEqual(["-100", "-101", "-200"]);
  });

  it("returns nothing when neither is configured", () => {
    expect(allConfiguredChatIds()).toEqual([]);
  });
});
