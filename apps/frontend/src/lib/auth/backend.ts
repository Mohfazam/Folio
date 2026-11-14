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

function backendBaseUrl() {
  const value = process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000";
  return value.replace(/\/+$/, "");
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function syncAuthenticatedUser(accessToken: string): Promise<void> {
  const response = await fetch(`${backendBaseUrl()}/api/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  const payload = await parseJson<{ ok?: boolean; error?: string }>(response).catch(() => ({ ok: false } as { ok?: boolean; error?: string }));
  if (!response.ok || payload.ok !== true) {
    console.error("[auth/sync] Backend provisioning failed:", response.status, payload.error);
    throw new Error(payload.error || "Unable to provision your Foolioo workspace");
  }
}

export async function getOnboardingState(accessToken: string): Promise<OnboardingSnapshot | null> {
  const response = await fetch(`${backendBaseUrl()}/api/onboarding`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  // A 403 here means Supabase is valid, but the matching Neon workspace/user
  // has not been provisioned yet. The onboarding entry point can sync it.
  if (response.status === 403) return null;

  const payload = await parseJson<ApiEnvelope<OnboardingSnapshot>>(response).catch(() => ({ ok: false } as ApiEnvelope<OnboardingSnapshot>));
  if (!response.ok || payload.ok !== true || !payload.onboarding) {
    console.error("[onboarding/get] Backend request failed:", response.status, payload.error);
    throw new Error(payload.error || "Unable to read onboarding status");
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

export async function requestAuthOtp(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to send verification code" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error("[auth/otp/send] Network error:", err);
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function verifyAuthOtp(email: string, otp: string): Promise<{ ok: boolean; verified?: boolean; error?: string }> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
      cache: "no-store",
    });
    const payload = await parseJson<{ ok?: boolean; verified?: boolean; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Invalid verification code" };
    }
    return { ok: true, verified: payload.verified };
  } catch (err: unknown) {
    console.error("[auth/otp/verify] Network error:", err);
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function requestSupportOtp(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/support/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to send support verification code" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error("[support/otp/send] Network error:", err);
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function verifySupportOtp(email: string, otp: string): Promise<{ ok: boolean; verified?: boolean; error?: string }> {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/support/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
      cache: "no-store",
    });
    const payload = await parseJson<{ ok?: boolean; verified?: boolean; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Invalid code" };
    }
    return { ok: true, verified: payload.verified };
  } catch (err: unknown) {
    console.error("[support/otp/verify] Network error:", err);
    return { ok: false, error: "Network error. Please try again." };
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
    const response = await fetch(`${backendBaseUrl()}/api/support/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    const payload = await parseJson<{ ok?: boolean; message?: string; error?: string }>(response);
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error || "Failed to submit support ticket" };
    }
    return { ok: true, message: payload.message };
  } catch (err: unknown) {
    console.error("[support/ticket] Network error:", err);
    return { ok: false, error: "Network error. Please try again." };
  }
}

