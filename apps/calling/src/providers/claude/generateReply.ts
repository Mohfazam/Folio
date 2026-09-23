import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";

const anthropic = new Anthropic({ apiKey: env.claudeApiKey });

export async function generateReply(conversationHistory: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: conversationHistory,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
