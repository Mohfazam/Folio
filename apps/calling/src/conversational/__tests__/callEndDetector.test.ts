import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCallEndIntent, buildFastFarewell } from "../callEndDetector.js";

describe("Call End Detector", () => {
  it("detects explicit farewells accurately", () => {
    assert.equal(isCallEndIntent("bye"), true);
    assert.equal(isCallEndIntent("okay bye"), true);
    assert.equal(isCallEndIntent("thank you bye"), true);
    assert.equal(isCallEndIntent("goodbye!"), true);
    assert.equal(isCallEndIntent("theek hai bye"), true);
    assert.equal(isCallEndIntent("alvida"), true);
  });

  it("detects completion and gratitude exit phrases", () => {
    assert.equal(isCallEndIntent("that's all thank you"), true);
    assert.equal(isCallEndIntent("that will be all"), true);
    assert.equal(isCallEndIntent("nothing else, thanks"), true);
    assert.equal(isCallEndIntent("no that's it"), true);
  });

  it("detects polite opt-outs and disinterest", () => {
    assert.equal(isCallEndIntent("not interested"), true);
    assert.equal(isCallEndIntent("no thanks"), true);
    assert.equal(isCallEndIntent("no thank you"), true);
    assert.equal(isCallEndIntent("no need, thanks"), true);
    assert.equal(isCallEndIntent("nahi chahiye"), true);
  });

  it("detects busy and hangup commands", () => {
    assert.equal(isCallEndIntent("i have to go"), true);
    assert.equal(isCallEndIntent("got to go bye"), true);
    assert.equal(isCallEndIntent("cut the call"), true);
    assert.equal(isCallEndIntent("phone rakho"), true);
  });

  it("does not false-positive on regular questions", () => {
    assert.equal(isCallEndIntent("what is the fee?"), false);
    assert.equal(isCallEndIntent("tell me about the MPC program"), false);
    assert.equal(isCallEndIntent("where is the campus located?"), false);
    assert.equal(isCallEndIntent("can you explain the installments?"), false);
  });

  it("builds localized fast farewells", () => {
    assert.match(buildFastFarewell("en-IN"), /wonderful day|Goodbye/i);
    assert.match(buildFastFarewell("hi"), /dhanyawad|Namaste/i);
    assert.match(buildFastFarewell("te"), /dhanyavadhalu|Namaskaram/i);
  });
});
