export type EdgeCaseAction =
  | { type: "continue_intro" }
  | { type: "ignore_filler" }
  | { type: "audibility_check"; replyText: string }
  | { type: "busy_callback"; replyText: string }
  | { type: "opt_out"; replyText: string }
  | { type: "ai_disclosure"; replyText: string }
  | { type: "silence_prompt"; replyText: string }
  | { type: "silence_exit"; replyText: string }
  | { type: "passthrough" };

export interface CallerIntentState {
  consecutiveHelloCount: number;
  totalHelloCount: number;
  introCompleted: boolean;
  silenceCycle: number;
  hasAudioComplaint: boolean;
  lastCallerUtterance?: string;
  lastCallerLanguage?: string;
}
