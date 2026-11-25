import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileSystemPrompt } from "../src/prompts/compileSystemPrompt.js";

describe("campaign prompt delivery guidance", () => {
  it("asks the agent to cover talking points naturally across turns", () => {
    const prompt = compileSystemPrompt({
      campaign: {
        keyTalkingPoints: ["Flexible schedule", "Scholarship options"],
      },
    });

    assert.match(prompt, /Cover every relevant talking point across the conversation/);
    assert.match(prompt, /Flexible schedule/);
    assert.match(prompt, /Scholarship options/);
  });

  it("omits talking-point guidance when the campaign has no talking points", () => {
    const prompt = compileSystemPrompt({ campaign: { name: "General inquiry" } });

    assert.doesNotMatch(prompt, /Cover every relevant talking point across the conversation/);
  });
});
