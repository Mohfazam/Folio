// Builds PlivoXML responses. Streams live audio to our own WebSocket endpoint
// instead of playing a static message.
export function buildStreamXml(streamWebsocketUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Stream bidirectional="true" keepCallAlive="true">${streamWebsocketUrl}</Stream>
    </Response>`;
}

export function buildSpeakXml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Speak>${message}</Speak>
    </Response>`;
}
