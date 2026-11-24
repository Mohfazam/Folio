import "server-only";

type HeaderReader = {
  get(name: string): string | null | undefined;
};

const EXACT_LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function normalizeHostname(rawHostHeader: string | null | undefined): string {
  if (!rawHostHeader) return "";
  const firstCandidate = rawHostHeader.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!firstCandidate) return "";

  if (firstCandidate.startsWith("[")) {
    const endBracket = firstCandidate.indexOf("]");
    if (endBracket !== -1) {
      return firstCandidate.slice(0, endBracket + 1);
    }
  }

  const colonCount = (firstCandidate.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    return firstCandidate.split(":")[0]?.trim() ?? "";
  }

  return firstCandidate;
}

/**
 * Returns true ONLY when running in a non-production environment and the
 * incoming request host is strictly localhost / loopback (127.0.0.1 or ::1).
 */
export function isLocalhostRequest(headersLike: HeaderReader | Headers): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.ALLOW_LOCAL_DEV_PLAN === "false") {
    return false;
  }

  const rawHost =
    headersLike.get("x-forwarded-host") ||
    headersLike.get("host") ||
    "";
  const hostname = normalizeHostname(rawHost);
  return EXACT_LOCAL_HOSTS.has(hostname);
}
