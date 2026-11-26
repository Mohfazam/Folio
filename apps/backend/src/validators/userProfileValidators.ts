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

export function guardAgainstPhoneNumberChange(payload: Record<string, unknown>): { rejected: boolean; error?: string } {
  const forbiddenPhoneKeys = ["phoneNumber", "phone_number", "phone", "callerIdNumber", "caller_id_number"];
  for (const key of forbiddenPhoneKeys) {
    if (key in payload && payload[key] !== undefined) {
      return {
        rejected: true,
        error: "Phone numbers cannot be updated through this unverified endpoint. Changing a phone number requires two-factor OTP verification."
      };
    }
  }
  return { rejected: false };
}

export function validateCallingHoursTime(timeStr: unknown): { valid: boolean; value?: string; error?: string } {
  if (typeof timeStr !== "string") {
    return { valid: false, error: "Calling hour time must be a string formatted as HH:mm or HH:mm:ss" };
  }

  const trimmed = timeStr.trim();
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
  const match = trimmed.match(timeRegex);
  if (!match) {
    return { valid: false, error: "Calling hour must be a valid 24-hour time between 00:00 and 23:59" };
  }

  // Normalize to HH:mm:00 if seconds missing
  const hours = match[1];
  const minutes = match[2];
  const seconds = match[3] || "00";
  return { valid: true, value: `${hours}:${minutes}:${seconds}` };
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

export function validateBio(bio: unknown): { valid: boolean; value?: string | null; error?: string } {
  if (bio === null || bio === undefined || bio === "") {
    return { valid: true, value: null };
  }

  if (typeof bio !== "string") {
    return { valid: false, error: "Bio must be a string or null" };
  }

  const trimmed = bio.trim();
  if (trimmed.length > 500) {
    return { valid: false, error: "Bio cannot exceed 500 characters" };
  }

  const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return { valid: true, value: sanitized };
}

export function validateJobTitle(title: unknown): { valid: boolean; value?: string | null; error?: string } {
  if (title === null || title === undefined || title === "") {
    return { valid: true, value: null };
  }

  if (typeof title !== "string") {
    return { valid: false, error: "Job title must be a string or null" };
  }

  const trimmed = title.trim();
  if (trimmed.length > 100) {
    return { valid: false, error: "Job title cannot exceed 100 characters" };
  }

  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  return { valid: true, value: sanitized };
}

export function guardAgainstEmailChange(payload: Record<string, unknown>): { rejected: boolean; error?: string } {
  const forbiddenEmailKeys = ["email", "userEmail", "user_email"];
  for (const key of forbiddenEmailKeys) {
    if (key in payload && payload[key] !== undefined) {
      return {
        rejected: true,
        error: "Email addresses cannot be updated through this unverified endpoint. Changing an email requires verification."
      };
    }
  }
  return { rejected: false };
}

export function validateTimezone(tz: unknown): { valid: boolean; value?: string; error?: string } {
  if (typeof tz !== "string" || tz.trim().length === 0) {
    return { valid: false, error: "Timezone must be a non-empty string" };
  }

  const trimmed = tz.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return { valid: true, value: trimmed };
  } catch {
    return { valid: false, error: `Invalid IANA timezone identifier: '${trimmed}'` };
  }
}
