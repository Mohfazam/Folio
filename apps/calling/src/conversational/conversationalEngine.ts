import type { CallerIntentState, EdgeCaseAction } from "./types.js";
import { isBackchannel } from "./backchannelDetector.js";
import { handleGenericGreeting } from "./genericGreetingTracker.js";
import { isAudioIssueUtterance, buildAudibilityResponse } from "./audioIssueDetector.js";
import { isBusyUtterance, buildBusyCallbackResponse } from "./busyDetector.js";
import { isOptOutUtterance, buildOptOutResponse } from "./optOutDetector.js";
import { isAiIdentityInquiry, buildAiIdentityResponse } from "./aiIdentityDetector.js";

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
    };
  }

  public markIntroCompleted(): void {
    this.state.introCompleted = true;
  }

  public isIntroCompleted(): boolean {
    return this.state.introCompleted;
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

    // 3. Audio / Audibility complaints ("Can't hear you", "Am I audible")
    if (isAudioIssueUtterance(trimmed)) {
      this.state.hasAudioComplaint = true;
      return {
        type: "audibility_check",
        replyText: buildAudibilityResponse(currentLang),
      };
    }

    // 4. Busy / In meeting / Driving / Callback requests
    if (isBusyUtterance(trimmed)) {
      return {
        type: "busy_callback",
        replyText: buildBusyCallbackResponse(currentLang),
      };
    }

    // 5. Opt-Out / Do Not Call requests
    if (isOptOutUtterance(trimmed)) {
      return {
        type: "opt_out",
        replyText: buildOptOutResponse(currentLang),
      };
    }

    // 6. AI Identity Inquiry ("Are you a bot?")
    if (isAiIdentityInquiry(trimmed)) {
      return {
        type: "ai_disclosure",
        replyText: buildAiIdentityResponse(this.context.persona, this.context.businessName, currentLang),
      };
    }

    // 7. Normal conversational query -> passthrough to Gemini
    return { type: "passthrough" };
  }
}
