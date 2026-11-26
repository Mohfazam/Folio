/**
 * Formats Indian E.164 phone numbers (`+91XXXXXXXXXX`) with a space after `+91`
 * (e.g. `+919550163004` -> `+91 9550163004`) while leaving non-matching values intact.
 */
export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^\+91\s*(\d{10})$/, "+91 $1");
}
