import { sanitizeUserError } from "@/lib/utils/sanitize-error";
export type OnboardingSnapshot = {
  version: 1;
  status: "not_started" | "in_progress" | "completed";
  currentStep: number;
  hasSeenWelcome: boolean;
  answers: {
    primaryGoals?: string[];
    usesCrmOrDialer?: "yes" | "no";
    channels?: string[];
    monthlyContacts?: string;
    managesOutboundTeam?: "yes" | "no" | "not_yet";
    launchTimeline?: string;
  };
  skippedSteps: number[];
  completedAt: string | null;
  updatedAt: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  error?: string;
  onboarding?: T;
};

const BACKEND_REQUEST_TIMEOUT_MS = 12_000;

function backendBaseUrl() {
  const raw =
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000";
  // Avoid Node/Windows IPv6 ::1 vs IPv4 0.0.0.0 resolution mismatches on localhost
  const normalized = raw.replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1");
  return normalized.replace(/\/+$/, "");
}

function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string } | undefined;
  const code = cause?.code || (err as { code?: string }).code;
  if (err.name === "TimeoutError" || err.name === "AbortError" || code === "ETIMEDOUT") {
    return "timeout";
  }
  if (code === "ECONNREFUSED") {
    return "connection_refused";
  }
  return code || err.message;
}

function userFriendlyNetworkError(err: unknown): string {
  const reason = describeFetchError(err);
  if (reason === "timeout") {
    return "The server took too long to respond. Please try again.";
  }
  if (reason === "connection_refused") {
    return `Unable to connect to the backend service (${backendBaseUrl()}). Make sure the backend server is running.`;
  }
  return "Unable to reach the authentication service. Please check that the backend is running and try again.";
}

async function fetchBackend(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(BACKEND_REQUEST_TIMEOUT_MS),
  });
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function syncAuthenticatedUser(accessToken: string): Promise<void> {
  const response = await fetchBackend("/api/auth/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = await parseJson<{ ok?: boolean; error?: string }>(response).catch(() => ({ ok: false } as { ok?: boolean; error?: string }));
  if (!response.ok || payload.ok !== true) {
    console.error("[auth/sync] Backend provisioning failed:", response.status, payload.error);
    throw new Error(sanitizeUserError(payload.error, "Unable to provision your Foolioo workspace"));
  }
}

export async function getOnboardingState(accessToken: string): Promise<OnboardingSnapshot | null> {
  const response = await fetchBackend("/api/onboarding", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // A 403 here means Supabase is valid, but the matching Neon workspace/user
  // has not been provisioned yet. The onboarding entry point can sync it.
  if (response.status === 403) return null;

  const payload = await parseJson<ApiEnvelope<OnboardingSnapshot>>(response).catch(() => ({ ok: false } as ApiEnvelope<OnboardingSnapshot>));
  if (!response.ok || payload.ok !== true || !payload.onboarding) {
    console.error("[onboarding/get] Backend request failed:", response.status, payload.error);
    throw new Error(sanitizeUserError(payload.error, "Unable to read onboarding status"));
  }

  return payload.onboarding;
}

export async function syncAndGetOnboardingState(accessToken: string): Promise<OnboardingSnapshot> {
  await syncAuthenticatedUser(accessToken);
  const onboarding = await getOnboardingState(accessToken);
  if (!onboarding) {
    throw new Error("Workspace provisioning completed, but the workspace is not available yet");
  }
  return onboarding;
}

export async function resolvePostAuthDestination(accessToken: string): Promise<"/onboarding" | "/dashboard"> {
  const onboarding = await syncAndGetOnboardingState(accessToken);
  return onboarding.status === "completed" ? "/dashboard" : "/onboarding";
}

export async function registerWithEmail(data: {
  name?: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchBackend("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Could not create account. Please try again." };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error(`[auth/register] Failed to reach ${backendBaseUrl()}/api/auth/register:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function loginWithEmail(data: {
  email: string;
  password: string;
}): Promise<{
  ok: boolean;
  token?: string;
  requiresVerification?: boolean;
  user?: unknown;
  client?: unknown;
  error?: string;
}> {
  try {
    const response = await fetchBackend("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await parseJson<{
      ok?: boolean;
      token?: string;
      requiresVerification?: boolean;
      user?: unknown;
      client?: unknown;
      error?: string;
    }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error || "Invalid email or password.",
        requiresVerification: payload.requiresVerification,
      };
    }
    return {
      ok: true,
      token: payload.token,
      user: payload.user,
      client: payload.client,
    };
  } catch (err: unknown) {
    console.error(`[auth/login] Failed to reach ${backendBaseUrl()}/api/auth/login:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function requestAuthOtp(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchBackend("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to send verification code" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error(`[auth/otp/send] Failed to reach ${backendBaseUrl()}/api/auth/otp/send:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function verifyAuthOtp(
  email: string,
  otp: string,
): Promise<{ ok: boolean; token?: string; verified?: boolean; user?: unknown; client?: unknown; error?: string }> {
  try {
    const response = await fetchBackend("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const payload = await parseJson<{
      ok?: boolean;
      token?: string;
      verified?: boolean;
      user?: unknown;
      client?: unknown;
      error?: string;
    }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Invalid verification code" };
    }
    return {
      ok: true,
      token: payload.token,
      verified: payload.verified,
      user: payload.user,
      client: payload.client,
    };
  } catch (err: unknown) {
    console.error(`[auth/otp/verify] Failed to reach ${backendBaseUrl()}/api/auth/otp/verify:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function requestPasswordResetOtp(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchBackend("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to send password reset code" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error(`[auth/password-reset/request] Failed to reach ${backendBaseUrl()}/api/auth/password-reset/request:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function verifyPasswordResetOtp(data: {
  email: string;
  otp: string;
  password: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchBackend("/api/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to reset password" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error(`[auth/password-reset/verify] Failed to reach ${backendBaseUrl()}/api/auth/password-reset/verify:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}

export async function submitSupportTicket(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  contactPhone?: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchBackend("/api/support/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response).catch(() => ({
      ok: false,
      error: `Server returned an unexpected response (${response.status}).`,
    }));
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to submit support ticket" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error(`[support/ticket] Failed to reach ${backendBaseUrl()}/api/support/ticket:`, err);
    return { ok: false, error: userFriendlyNetworkError(err) };
  }
}
