import assert from "node:assert/strict";
import test from "node:test";
import { compileSystemPrompt } from "../src/prompts/compileSystemPrompt.js";

test("campaign prompts require natural coverage of talking points", () => {
  const prompt = compileSystemPrompt({
    business: { displayName: "Example Business" },
    campaign: {
      keyTalkingPoints: ["Annual membership", "Free assessment"],
      callToAction: "Book a visit",
    },
  });

  assert.match(prompt, /Cover each relevant talking point naturally across the conversation/);
  assert.match(prompt, /Annual membership/);
  assert.match(prompt, /Free assessment/);
  assert.match(prompt, /Desired Call-To-Action \(Closing\): Book a visit/);
  assert.match(prompt, /Do not recite the list as a monologue/);
});

test("campaign delivery guidance is omitted when no talking points are configured", () => {
  const prompt = compileSystemPrompt({
    business: { displayName: "Example Business" },
    campaign: { primaryObjective: "Answer customer questions" },
  });

  assert.doesNotMatch(prompt, /Cover each relevant talking point naturally across the conversation/);
});
