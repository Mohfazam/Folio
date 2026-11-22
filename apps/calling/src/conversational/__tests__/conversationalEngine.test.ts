import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBackchannel } from "../backchannelDetector.js";
import { isGenericGreeting, handleGenericGreeting } from "../genericGreetingTracker.js";
import { isAudioIssueUtterance } from "../audioIssueDetector.js";
import { isBusyUtterance } from "../busyDetector.js";
import { isOptOutUtterance } from "../optOutDetector.js";
import { isAiIdentityInquiry } from "../aiIdentityDetector.js";
import { isHoldUtterance } from "../holdDetector.js";
import { isRepeatUtterance } from "../repeatDetector.js";
import { isTransferUtterance } from "../transferDetector.js";
import { isConfusionUtterance } from "../confusionDetector.js";
import { isProfanityUtterance, buildProfanityWarning } from "../profanityDetector.js";
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

  it("detects hold and wait requests", () => {
    assert.equal(isHoldUtterance("Hold on a second"), true);
    assert.equal(isHoldUtterance("Ek minute ruko"), true);
    assert.equal(isHoldUtterance("Just a moment"), true);
    assert.equal(isHoldUtterance("Wait wait please"), true);
    assert.equal(isHoldUtterance("Tell me more"), false);
  });

  it("detects repeat requests", () => {
    assert.equal(isRepeatUtterance("Can you repeat that?"), true);
    assert.equal(isRepeatUtterance("What did you say?"), true);
    assert.equal(isRepeatUtterance("Dobara bolo"), true);
    assert.equal(isRepeatUtterance("Phir se batao please"), true);
    assert.equal(isRepeatUtterance("Okay I understood"), false);
  });

  it("detects human transfer requests", () => {
    assert.equal(isTransferUtterance("I want to talk to a human"), true);
    assert.equal(isTransferUtterance("Connect me to a manager"), true);
    assert.equal(isTransferUtterance("Kisi insaan se baat karvao"), true);
    assert.equal(isTransferUtterance("I want to buy the course"), false);
  });

  it("detects confusion and clarification requests", () => {
    assert.equal(isConfusionUtterance("I don't understand"), true);
    assert.equal(isConfusionUtterance("Samajh nahi aaya"), true);
    assert.equal(isConfusionUtterance("What do you mean?"), true);
    assert.equal(isConfusionUtterance("That is very clear"), false);
  });

  it("detects profanity and handles escalation warnings", () => {
    assert.equal(isProfanityUtterance("shut up you idiot"), true);
    assert.equal(isProfanityUtterance("bakwas mat kar"), true);
    assert.equal(isProfanityUtterance("hello good morning"), false);

    const warn1 = buildProfanityWarning(1, "en-IN");
    assert.equal(warn1.shouldHangup, false);

    const warn2 = buildProfanityWarning(2, "en-IN");
    assert.equal(warn2.shouldHangup, true);
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

    // Hold request
    assert.equal(engine.evaluateUtterance("One second hold on").type, "hold_wait");

    // Repeat request
    engine.setLastAssistantReply("We have 3 plans available.");
    const repeatAction = engine.evaluateUtterance("Can you repeat that?");
    assert.equal(repeatAction.type, "repeat_request");
    assert.match((repeatAction as any).replyText, /3 plans available/);

    // Human transfer
    assert.equal(engine.evaluateUtterance("Connect me to a real person").type, "transfer_agent");

    // Confusion
    assert.equal(engine.evaluateUtterance("I don't understand").type, "clarification");

    // Profanity 1st warning then termination
    const prof1 = engine.evaluateUtterance("shut up idiot");
    assert.equal(prof1.type, "escalation_warning");
    assert.equal((prof1 as any).shouldHangup, false);

    const prof2 = engine.evaluateUtterance("you idiot");
    assert.equal(prof2.type, "escalation_warning");
    assert.equal((prof2 as any).shouldHangup, true);
  });
});
