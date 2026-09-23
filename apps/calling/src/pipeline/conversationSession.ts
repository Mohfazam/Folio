import { connectSarvamSTT } from "../providers/sarvam/stt";
import { connectSarvamTTS, sendTextToSpeak } from "../providers/sarvam/tts";
import { generateReply } from "../providers/claude/generateReply";

// Coordinates one live call: STT -> Claude -> TTS.
// This is the orchestration layer -- skeleton for now, will connect to
// Plivo's live audio stream once that route is wired up.
export function startConversationSession() {
  const history: { role: "user" | "assistant"; content: string }[] = [];

  const sttSocket = connectSarvamSTT(async (transcript) => {
    console.log("Parent said:", transcript);
    history.push({ role: "user", content: transcript });

    const reply = await generateReply(history);
    console.log("AI reply:", reply);
    history.push({ role: "assistant", content: reply });

    sendTextToSpeak(ttsSocket, reply);
  });

  const ttsSocket = connectSarvamTTS((audioChunk) => {
    // TODO: forward this audio chunk back to Plivo's stream
    console.log("Received audio chunk from TTS, length:", audioChunk.length);
  });

  return { sttSocket, ttsSocket };
}
