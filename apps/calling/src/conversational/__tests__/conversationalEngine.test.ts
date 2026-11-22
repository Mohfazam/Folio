import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBackchannel } from "../backchannelDetector.js";
import { isGenericGreeting, handleGenericGreeting } from "../genericGreetingTracker.js";
import { isAudioIssueUtterance, buildAudibilityResponse } from "../audioIssueDetector.js";
import { isBusyUtterance, buildBusyCallbackResponse } from "../busyDetector.js";
import { isOptOutUtterance, buildOptOutResponse } from "../optOutDetector.js";
import { isAiIdentityInquiry, buildAiIdentityResponse } from "../aiIdentityDetector.js";
import { buildOpeningIntro } from "../introManager.js";
import { ConversationalEngine } from "../conversationalEngine.js";
import type { CallerIntentState } from "../types.js";

describe("Conversational Edge Case Handlers", () => {
  it("detects backchannel affirmations accurately", () => {
    assert.equal(isBackchannel("haan"), true);
    assert.equal(isBackchannel("hmm"), true);
    assert.equal(isBackchannel("okay right"), true);
    assert.equal(isBackchannel("theek hai"), true);
    assert.equal(isBackchannel("what is the price?"), false);
  });

  it("handles repeated generic greetings and hits threshold", () => {
    const state: CallerIntentState = {
      consecutiveHelloCount: 0,
      totalHelloCount: 0,
      introCompleted: true,
      silenceCycle: 0,
      hasAudioComplaint: false,
    };

    assert.equal(isGenericGreeting("hello"), true);
    assert.equal(isGenericGreeting("haanji"), true);
    assert.equal(isGenericGreeting("kaun bol raha hai"), true);

    // Call 1 & 2
    assert.equal(handleGenericGreeting("hello", state, 3), null);
    assert.equal(state.consecutiveHelloCount, 1);

    assert.equal(handleGenericGreeting("hello", state, 3), null);
    assert.equal(state.consecutiveHelloCount, 2);

    // Call 3 hits threshold
    const action = handleGenericGreeting("hello", state, 3);
    assert.notEqual(action, null);
    assert.equal(action?.type, "audibility_check");
  });

  it("detects audio complaints and audibility queries", () => {
    assert.equal(isAudioIssueUtterance("Am I audible?"), true);
    assert.equal(isAudioIssueUtterance("Aapki aawaz nahi aa rahi"), true);
    assert.equal(isAudioIssueUtterance("You are breaking up"), true);
    assert.equal(isAudioIssueUtterance("Tell me about admissions"), false);
  });

  it("detects busy and callback requests", () => {
    assert.equal(isBusyUtterance("I am in a meeting, call me later"), true);
    assert.equal(isBusyUtterance("Baad me baat karo"), true);
    assert.equal(isBusyUtterance("Driving right now"), true);
    assert.equal(isBusyUtterance("I want to know the fee"), false);
  });

  it("detects opt-outs and DND requests", () => {
    assert.equal(isOptOutUtterance("Don't call me again"), true);
    assert.equal(isOptOutUtterance("Not interested"), true);
    assert.equal(isOptOutUtterance("Wrong number"), true);
    assert.equal(isOptOutUtterance("Please share the details"), false);
  });

  it("detects AI identity inquiries", () => {
    assert.equal(isAiIdentityInquiry("Are you a robot?"), true);
    assert.equal(isAiIdentityInquiry("Kya aap AI ho?"), true);
    assert.equal(isAiIdentityInquiry("Are you an automated system?"), true);
    assert.equal(isAiIdentityInquiry("Who is your founder?"), false);
  });

  it("builds natural opening intro", () => {
    const introWithName = buildOpeningIntro({
      contactName: "Mubashir",
      persona: "Aarohi",
      businessName: "Foolioo",
      language: "en-IN",
    });
    assert.match(introWithName, /Hello Mubashir! This is Aarohi calling from Foolioo/);

    const genericIntro = buildOpeningIntro({
      persona: "Aarohi",
      businessName: "Foolioo",
      language: "en-IN",
    });
    assert.match(genericIntro, /Hello! This is Aarohi calling from Foolioo/);
  });

  it("evaluates conversational engine transitions", () => {
    const engine = new ConversationalEngine({ persona: "Aarohi", businessName: "Foolioo" });

    // Early hello during intro is ignored to let intro finish
    assert.equal(engine.evaluateUtterance("hello").type, "continue_intro");

    engine.markIntroCompleted();

    // Normal utterance goes to Gemini passthrough
    assert.equal(engine.evaluateUtterance("I need help with my account").type, "passthrough");

    // Audio issue is caught directly
    assert.equal(engine.evaluateUtterance("Aapki aawaz nahi aa rahi").type, "audibility_check");
  });
});
