import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  plivoAuthId: required("PLIVO_AUTH_ID"),
  plivoAuthToken: required("PLIVO_AUTH_TOKEN"),
  plivoPhoneNumber: required("PLIVO_PHONE_NUMBER"),
  myTestPhoneNumber: required("MY_TEST_PHONE_NUMBER"),
  sarvamApiKey: required("SARVAM_API_KEY"),
  claudeApiKey: required("ANTHROPIC_API_KEY"),
  geminiApiKey: required("GEMINI_API_KEY"),
  publicUrl: required("PUBLIC_URL"), // your current ngrok URL
};
