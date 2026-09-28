// Tells Plivo to open a two-way live audio stream to our WebSocket endpoint.
// mu-law 8 kHz is Plivo's default phone-line format, and Sarvam STT accepts it as-is.
export function buildStreamXml(streamWebsocketUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${streamWebsocketUrl}</Stream>
</Response>`;
}

export function buildSpeakXml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>${message}</Speak>
</Response>`;
}
