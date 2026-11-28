import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composePostCallMessage } from "../src/services/aiComposer.js";

describe("Messenger Service", () => {
  it("generates a fallback message when options lack specifics", async () => {
    const text = await composePostCallMessage({
      contactName: "Alex",
      businessName: "Folio AI",
      fallbackLink: "https://folioo.app/demo",
    });

    assert.ok(text.includes("Alex"));
    assert.ok(text.includes("Folio AI"));
    assert.ok(text.includes("https://folioo.app/demo"));
  });

  it("handles empty options gracefully", async () => {
    const text = await composePostCallMessage({});
    assert.ok(typeof text === "string");
    assert.ok(text.length > 10);
  });
});
