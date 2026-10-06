/**
 * Accurately converts local calendar/time components in a specific timezone to a UTC Date object.
 */
export function getUtcDateForTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(guessUtc);

    const getPart = (type: string) => {
      const val = parts.find((p) => p.type === type)?.value;
      return val ? parseInt(val, 10) : 0;
    };

    const tzYear = getPart("year");
    const tzMonth = getPart("month");
    const tzDay = getPart("day");
    let tzHour = getPart("hour");
    if (tzHour === 24) tzHour = 0;
    const tzMinute = getPart("minute");
    const tzSecond = getPart("second");

    const tzDateAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
    const diffMs = tzDateAsUtc - guessUtc.getTime();

    return new Date(guessUtc.getTime() - diffMs);
  } catch {
    // If timezone is invalid or unrecognized, fallback to basic UTC
    return guessUtc;
  }
}

/**
 * Calculates the next retry schedule for an unanswered/failed call.
 * - Adds delayHours (default: 2h) to current time.
 * - If the candidate time is within calling hours, schedules at that time.
 * - If the candidate time is past callingHoursEnd, schedules for the next day at callingHoursStart.
 * - If the candidate time is before callingHoursStart, schedules for today at callingHoursStart.
 */
export function calculateNextRetrySchedule(
  timezone: string,
  callingHoursStart?: string | null,
  callingHoursEnd?: string | null,
  delayHours = 2
): Date {
  const tz = timezone || "Asia/Kolkata";
  const start = callingHoursStart ?? "09:00:00";
  const end = callingHoursEnd ?? "16:00:00";

  const [startHour = 9, startMin = 0] = start.split(":").map(Number);

  const now = new Date();
  const candidateUtc = new Date(now.getTime() + delayHours * 60 * 60 * 1000);

  // Extract parts of candidate date in target timezone
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(candidateUtc);
  } catch {
    // Fallback timezone to UTC
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(candidateUtc);
  }

  const getPart = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value;
    return val ? parseInt(val, 10) : 0;
  };

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  let hour = getPart("hour");
  if (hour === 24) hour = 0;
  const minute = getPart("minute");
  const second = getPart("second");

  const candidateTimeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

  if (candidateTimeString < start) {
    // Before calling window opens: schedule for today at callingHoursStart
    return getUtcDateForTimezone(year, month, day, startHour, startMin, 0, tz);
  }

  if (candidateTimeString > end) {
    // Past calling window today: schedule for next day at callingHoursStart
    return getUtcDateForTimezone(year, month, day + 1, startHour, startMin, 0, tz);
  }

  // Within calling window
  return candidateUtc;
}
