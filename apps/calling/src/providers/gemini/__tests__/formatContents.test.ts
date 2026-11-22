import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatContents } from "../generateReply.js";

describe("Gemini Content Formatting for Phone Calls", () => {
  it("prepends user trigger when history starts with assistant greeting", () => {
    const contents = formatContents([
      { role: "assistant", content: "Hello! This is Aarohi from Foolioo." },
      { role: "user", content: "Hi, who is this?" },
    ]);

    assert.equal(contents[0]?.role, "user");
    assert.match(contents[0]?.parts[0]?.text || "", /connected/i);
    assert.equal(contents[1]?.role, "model");
    assert.equal(contents[2]?.role, "user");
  });

  it("merges adjacent duplicate roles to maintain strict user/model alternation", () => {
    const contents = formatContents([
      { role: "user", content: "Hello" },
      { role: "user", content: "Can you hear me?" },
      { role: "assistant", content: "Yes I can" },
      { role: "assistant", content: "How can I help you today?" },
    ]);

    assert.equal(contents.length, 3); // 2 merged + user prompt at end
    assert.equal(contents[0]?.role, "user");
    assert.match(contents[0]?.parts[0]?.text || "", /Hello\nCan you hear me\?/);
    assert.equal(contents[1]?.role, "model");
    assert.match(contents[1]?.parts[0]?.text || "", /Yes I can\nHow can I help you today\?/);
  });

  it("ensures the final message is user so Gemini generates model response", () => {
    const contents = formatContents([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ]);

    const last = contents[contents.length - 1];
    assert.equal(last?.role, "user");
  });

  it("handles empty history gracefully", () => {
    const contents = formatContents([]);
    assert.equal(contents.length, 1);
    assert.equal(contents[0]?.role, "user");
  });
});
