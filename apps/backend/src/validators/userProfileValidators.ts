export function validateDisplayName(name: unknown): { valid: boolean; value?: string; error?: string } {
  if (typeof name !== "string") {
    return { valid: false, error: "Display name must be a string" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Display name cannot be empty" };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: "Display name cannot exceed 100 characters" };
  }

  // Strip null bytes or control characters
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  return { valid: true, value: sanitized };
}

export function validateAvatarUrl(url: unknown): { valid: boolean; value?: string | null; error?: string } {
  if (url === null || url === undefined || url === "") {
    return { valid: true, value: null };
  }

  if (typeof url !== "string") {
    return { valid: false, error: "Avatar URL must be a string or null" };
  }

  const trimmed = url.trim();
  if (trimmed.length > 2048) {
    return { valid: false, error: "Avatar URL cannot exceed 2048 characters" };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Avatar URL must use http or https protocol" };
    }
    return { valid: true, value: parsed.toString() };
  } catch {
    return { valid: false, error: "Invalid avatar URL format" };
  }
}
