export interface CallSessionState {
  callId: string;
  contactId?: string;
  startedAt: Date;
  transcriptSoFar: { role: "user" | "assistant"; content: string }[];
}
