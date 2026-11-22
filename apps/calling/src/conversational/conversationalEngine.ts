import type { CallerIntentState, EdgeCaseAction } from "./types.js";
import { isBackchannel } from "./backchannelDetector.js";
import { handleGenericGreeting } from "./genericGreetingTracker.js";
import { isAudioIssueUtterance, buildAudibilityResponse } from "./audioIssueDetector.js";
import { isBusyUtterance, buildBusyCallbackResponse } from "./busyDetector.js";
import { isOptOutUtterance, buildOptOutResponse } from "./optOutDetector.js";
import { isAiIdentityInquiry, buildAiIdentityResponse } from "./aiIdentityDetector.js";
import { isHoldUtterance, buildHoldResponse } from "./holdDetector.js";
import { isRepeatUtterance, buildRepeatPrefix } from "./repeatDetector.js";
import { isTransferUtterance, buildTransferResponse } from "./transferDetector.js";
import { isConfusionUtterance, buildClarificationPrefix } from "./confusionDetector.js";
import { isProfanityUtterance, buildProfanityWarning } from "./profanityDetector.js";

export interface ConversationalEngineContext {
  persona?: string;
  businessName?: string;
  language?: string;
}

export class ConversationalEngine {
  private readonly state: CallerIntentState;
  private readonly context: ConversationalEngineContext;

  constructor(context?: ConversationalEngineContext) {
    this.context = {
      persona: context?.persona || "Aarohi",
      businessName: context?.businessName || "Foolioo",
      language: context?.language || "en-IN",
    };
    this.state = {
      consecutiveHelloCount: 0,
      totalHelloCount: 0,
      introCompleted: false,
      silenceCycle: 0,
      hasAudioComplaint: false,
      profanityCount: 0,
    };
  }

  public markIntroCompleted(): void {
    this.state.introCompleted = true;
  }

  public isIntroCompleted(): boolean {
    return this.state.introCompleted;
  }

  public setLastAssistantReply(text: string): void {
    this.state.lastAssistantReply = text;
  }

  public getState(): Readonly<CallerIntentState> {
    return this.state;
  }

  public evaluateUtterance(text: string, language?: string): EdgeCaseAction {
    const trimmed = text.trim();
    if (!trimmed) {
      return { type: "ignore_filler" };
    }

    const currentLang = language || this.context.language || "en-IN";
    this.state.lastCallerUtterance = trimmed;
    this.state.lastCallerLanguage = currentLang;

    // 1. Passive backchannel while AI is speaking
    if (isBackchannel(trimmed)) {
      return { type: "ignore_filler" };
    }

    // 2. Generic greetings ("hello", "haanji", "yes speaking") tracking with threshold
    const greetingAction = handleGenericGreeting(trimmed, this.state, 3);
    if (greetingAction) {
      return greetingAction;
    }

    // 3. Profanity / Inappropriate abuse detection
    if (isProfanityUtterance(trimmed)) {
      this.state.profanityCount = (this.state.profanityCount || 0) + 1;
      const warning = buildProfanityWarning(this.state.profanityCount, currentLang);
      return {
        type: "escalation_warning",
        replyText: warning.replyText,
        shouldHangup: warning.shouldHangup,
      };
    }

    // 4. Audio / Audibility complaints ("Can't hear you", "Am I audible")
    if (isAudioIssueUtterance(trimmed)) {
      this.state.hasAudioComplaint = true;
      return {
        type: "audibility_check",
        replyText: buildAudibilityResponse(currentLang),
      };
    }

    // 5. Hold / Wait requests ("Hold on", "Ek second ruko")
    if (isHoldUtterance(trimmed)) {
      return {
        type: "hold_wait",
        replyText: buildHoldResponse(currentLang),
      };
    }

    // 6. Repeat requests ("Repeat that", "Dobara bolo")
    if (isRepeatUtterance(trimmed)) {
      const prev = this.state.lastAssistantReply;
      const prefix = buildRepeatPrefix(currentLang);
      const replay = prev ? `${prefix}${prev}` : buildAudibilityResponse(currentLang);
      return {
        type: "repeat_request",
        replyText: replay,
        previousReply: prev,
      };
    }

    // 7. Transfer to human representative ("Talk to human", "Agent se baat karvao")
    if (isTransferUtterance(trimmed)) {
      return {
        type: "transfer_agent",
        replyText: buildTransferResponse(currentLang),
      };
    }

    // 8. Confusion / Clarification ("I don't understand", "Samajh nahi aaya")
    if (isConfusionUtterance(trimmed)) {
      const prev = this.state.lastAssistantReply;
      const prefix = buildClarificationPrefix(currentLang);
      const clarification = prev
        ? `${prefix}${prev}`
        : currentLang.toLowerCase().startsWith("hi")
          ? "Ji koi baat nahi, main batati hoon ki humne aapko is vishay par jankari dene ke liye call kiya hai."
          : "No problem at all, I called to share quick information with you regarding our services.";
      return {
        type: "clarification",
        replyText: clarification,
      };
    }

    // 9. Busy / In meeting / Driving / Callback requests
    if (isBusyUtterance(trimmed)) {
      return {
        type: "busy_callback",
        replyText: buildBusyCallbackResponse(currentLang),
      };
    }

    // 10. Opt-Out / Do Not Call requests
    if (isOptOutUtterance(trimmed)) {
      return {
        type: "opt_out",
        replyText: buildOptOutResponse(currentLang),
      };
    }

    // 11. AI Identity Inquiry ("Are you a bot?")
    if (isAiIdentityInquiry(trimmed)) {
      return {
        type: "ai_disclosure",
        replyText: buildAiIdentityResponse(this.context.persona, this.context.businessName, currentLang),
      };
    }

    // 12. Normal conversational query -> passthrough to Gemini
    return { type: "passthrough" };
  }
}
