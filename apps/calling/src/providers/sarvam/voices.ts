/**
 * Sarvam Bulbul v3 speaker IDs supported by this calling service.
 * Keep this list aligned with the model configured in tts.ts.
 */
export const SARVAM_BULBUL_V3_SPEAKERS = [
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan",
  "simran", "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun",
  "manan", "sumit", "roopa", "kabir", "aayan", "ashutosh", "advait", "anand",
  "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti", "suhani",
  "mohit", "kavitha", "rehan", "soham", "rupali",
] as const;

export type SarvamBulbulV3Speaker = (typeof SARVAM_BULBUL_V3_SPEAKERS)[number];

export function isSarvamBulbulV3Speaker(value: unknown): value is SarvamBulbulV3Speaker {
  return typeof value === "string" && (SARVAM_BULBUL_V3_SPEAKERS as readonly string[]).includes(value);
}
