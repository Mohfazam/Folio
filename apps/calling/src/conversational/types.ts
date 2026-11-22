export type EdgeCaseAction =
  | { type: "continue_intro" }
  | { type: "ignore_filler" }
  | { type: "audibility_check"; replyText: string }
  | { type: "busy_callback"; replyText: string }
  | { type: "opt_out"; replyText: string }
  | { type: "ai_disclosure"; replyText: string }
  | { type: "hold_wait"; replyText: string }
  | { type: "repeat_request"; replyText: string; previousReply?: string }
  | { type: "transfer_agent"; replyText: string }
  | { type: "clarification"; replyText: string }
  | { type: "escalation_warning"; replyText: string; shouldHangup: boolean }
  | { type: "silence_prompt"; replyText: string }
  | { type: "silence_exit"; replyText: string }
  | { type: "passthrough" };

export interface CallerIntentState {
  consecutiveHelloCount: number;
  totalHelloCount: number;
  introCompleted: boolean;
  silenceCycle: number;
  hasAudioComplaint: boolean;
  profanityCount?: number;
  lastCallerUtterance?: string;
  lastCallerLanguage?: string;
  lastAssistantReply?: string;
}
