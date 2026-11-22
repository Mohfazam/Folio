import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldBargeIn, isAcousticEcho } from "../bargeInDetector.js";

describe("Barge-In Detector", () => {
  it("rejects acoustic echo from AI speech", () => {
    const aiSpeech = "Hello! This is Aarohi calling from Foolioo. Can you hear me clearly today?";
    assert.equal(isAcousticEcho("this is aarohi", aiSpeech), true);
    assert.equal(isAcousticEcho("calling from foolioo", aiSpeech), true);
    assert.equal(shouldBargeIn("this is aarohi", { lastAssistantReply: aiSpeech }), false);
  });

  it("rejects passive backchannels and solitary greetings", () => {
    assert.equal(shouldBargeIn("hmm"), false);
    assert.equal(shouldBargeIn("haan"), false);
    assert.equal(shouldBargeIn("okay"), false);
    assert.equal(shouldBargeIn("hello"), false);
    assert.equal(shouldBargeIn("yes"), false);
  });

  it("rejects ambient noise and background chatter murmurs", () => {
    assert.equal(shouldBargeIn("and so"), false);
    assert.equal(shouldBargeIn("in the"), false);
    assert.equal(shouldBargeIn("you know"), false);
    assert.equal(shouldBargeIn("kya hua"), false);
    assert.equal(shouldBargeIn("arre yaar"), false);
    assert.equal(shouldBargeIn("dekho ye"), false);
    assert.equal(shouldBargeIn("pani lao"), false);
  });

  it("allows explicit interruption commands", () => {
    assert.equal(shouldBargeIn("wait"), true);
    assert.equal(shouldBargeIn("please wait"), true);
    assert.equal(shouldBargeIn("stop"), true);
    assert.equal(shouldBargeIn("ruko"), true);
    assert.equal(shouldBargeIn("ek second"), true);
    assert.equal(shouldBargeIn("listen"), true);
    assert.equal(shouldBargeIn("suno"), true);
  });

  it("allows direct active questions", () => {
    assert.equal(shouldBargeIn("what is the fee"), true);
    assert.equal(shouldBargeIn("kitna fees lagega"), true);
    assert.equal(shouldBargeIn("enti details"), true);
    assert.equal(shouldBargeIn("can you tell me the timings"), true);
  });

  it("allows language switch requests immediately", () => {
    assert.equal(shouldBargeIn("Hindi me bolo"), true);
    assert.equal(shouldBargeIn("speak in Telugu"), true);
    assert.equal(shouldBargeIn("Can you speak in Hindi"), true);
    assert.equal(shouldBargeIn("Telugu please"), true);
  });

  it("allows substantive caller statements (>= 4 words)", () => {
    assert.equal(shouldBargeIn("I have a doubt about the hostel fee"), true);
    assert.equal(shouldBargeIn("Mujhe scholarship ke baare me puchna hai"), true);
  });
});
