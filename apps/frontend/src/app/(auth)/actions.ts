"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import {
  resolvePostAuthDestination,
  registerWithEmail,
  loginWithEmail,
  requestAuthOtp,
  verifyAuthOtp,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/lib/auth/backend";
import { FOOLIOO_SESSION_COOKIE } from "@/lib/auth/dashboard-request";

const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = process.env.NODE_ENV === "production" ? 8 : 60;
const authAttempts = new Map<string, number[]>();

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
} | null;

async function rateLimit(key: string, message: string): Promise<AuthState> {
  const ip =
    (await headers()).get("x-real-ip")?.trim() ??
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  const bucketKey = `${key}_${ip}`;
  const now = Date.now();
  const cutoff = now - AUTH_WINDOW_MS;

  const recent = (authAttempts.get(bucketKey) ?? []).filter((ts) => ts > cutoff);
  if (recent.length >= AUTH_MAX_ATTEMPTS) {
    authAttempts.set(bucketKey, recent);
    return { error: message };
  }

  recent.push(now);
  authAttempts.set(bucketKey, recent);

  // Bound map size in long-lived processes
  if (authAttempts.size > 5000) {
    for (const [k, timestamps] of authAttempts) {
      if (!timestamps.some((ts) => ts > cutoff)) {
        authAttempts.delete(k);
      }
    }
  }

  return null;
}

function resolveSafeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }
  return trimmed;
}

function finalizePostAuthRoute(destination: "/onboarding" | "/dashboard", rawRedirect?: unknown): string {
  const safeRedirect = resolveSafeRedirect(rawRedirect);
  if (destination === "/dashboard" && safeRedirect) {
    return safeRedirect;
  }
  return destination;
}

async function destinationOrError(accessToken: string): Promise<{ destination?: "/onboarding" | "/dashboard"; error?: string }> {
  try {
    return { destination: await resolvePostAuthDestination(accessToken) };
  } catch (error) {
    console.error("[auth] Could not prepare Foolioo workspace:", error);
    return { error: "Your account is authenticated, but we couldn't load your workspace. Please try signing in again." };
  }
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: FOOLIOO_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function signInAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const limited = await rateLimit("signin", "Too many login attempts. Please try again in a minute.");
  if (limited) return limited;

  const validated = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  let result: Awaited<ReturnType<typeof loginWithEmail>>;
  try {
    result = await loginWithEmail({
      email: validated.data.email,
      password: validated.data.password,
    });
  } catch (error) {
    console.error("[auth] loginWithEmail failed:", error);
    return { error: "Could not reach the authentication server. Please try again." };
  }

  if (!result.ok) {
    if (result.requiresVerification) {
      redirect(`/verify-email?email=${encodeURIComponent(validated.data.email)}&unconfirmed=true`);
    }
    return { error: result.error || "Invalid email or password." };
  }

  if (!result.token) {
    return { error: "Unable to establish session. Please try again." };
  }

  await setSessionCookie(result.token);

  const dest = await destinationOrError(result.token);
  if (dest.error || !dest.destination) {
    return { error: dest.error ?? "Unable to load your workspace." };
  }
  redirect(finalizePostAuthRoute(dest.destination, formData.get("redirectTo")) as never);
}

export async function signUpAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const limited = await rateLimit("signup", "Too many sign-up attempts. Please try again in a minute.");
  if (limited) return limited;

  const validated = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  // Direct backend registration with network/timeout protection so isPending never hangs
  let result: Awaited<ReturnType<typeof registerWithEmail>>;
  try {
    result = await registerWithEmail({
      name: validated.data.name,
      email: validated.data.email,
      password: validated.data.password,
    });
  } catch (error) {
    console.error("[auth] registerWithEmail failed:", error);
    return { error: "Could not reach the server to create your account. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error || "Could not create account. Please try again." };
  }

  // Redirect to email OTP verification page
  const safeRedirect = resolveSafeRedirect(formData.get("redirectTo"));
  const nextParam = safeRedirect ? `&redirect=${encodeURIComponent(safeRedirect)}` : "";
  redirect(`/verify-email?email=${encodeURIComponent(validated.data.email)}${nextParam}`);
}

export async function verifyOtpAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const limited = await rateLimit("verify_otp", "Too many verification attempts. Please try again in a minute.");
  if (limited) return limited;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const otp = String(formData.get("otp") ?? "").trim();

  if (!email || !otp) {
    return { error: "Please enter the 6-digit verification code." };
  }

  let result: Awaited<ReturnType<typeof verifyAuthOtp>>;
  try {
    result = await verifyAuthOtp(email, otp);
  } catch (error) {
    console.error("[auth] verifyAuthOtp failed:", error);
    return { error: "Could not verify your code right now. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error || "Invalid or expired verification code." };
  }

  if (!result.token) {
    redirect("/sign-in?verified=true");
  }

  await setSessionCookie(result.token);

  const dest = await destinationOrError(result.token);
  if (dest.error || !dest.destination) {
    redirect((resolveSafeRedirect(formData.get("redirectTo")) ?? "/dashboard") as never);
  }
  redirect(finalizePostAuthRoute(dest.destination, formData.get("redirectTo")) as never);
}

export async function resendOtpAction(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!email) return { ok: false, error: "Email address is required" };
  try {
    return await requestAuthOtp(email);
  } catch (error) {
    console.error("[auth] requestAuthOtp failed:", error);
    return { ok: false, error: "Could not resend verification code. Please try again." };
  }
}

export async function resendPasswordResetOtpAction(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!email) return { ok: false, error: "Email address is required" };
  try {
    return await requestPasswordResetOtp(email);
  } catch (error) {
    console.error("[auth] requestPasswordResetOtp failed:", error);
    return { ok: false, error: "Could not resend reset code. Please try again." };
  }
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(FOOLIOO_SESSION_COOKIE);

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  redirect("/sign-in");
}

export async function forgotPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const limited = await rateLimit("forgot", "Too many requests. Please try again in a minute.");
  if (limited) return limited;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { fieldErrors: { email: ["Please enter a valid email address."] } };
  }

  let result: Awaited<ReturnType<typeof requestPasswordResetOtp>>;
  try {
    result = await requestPasswordResetOtp(email);
  } catch (error) {
    console.error("[auth] requestPasswordResetOtp failed:", error);
    return { error: "Could not send a password reset code. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error || "Could not send a password reset code." };
  }
  redirect(`/reset-password?email=${encodeURIComponent(email)}&sent=true`);
}

export async function resetPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const otp = String(formData.get("otp") ?? "").trim();
  const validated = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }
  if (!email || !/^\d{6}$/.test(otp)) {
    return { error: "Enter your email and the 6-digit reset code." };
  }

  let result: Awaited<ReturnType<typeof verifyPasswordResetOtp>>;
  try {
    result = await verifyPasswordResetOtp({
      email,
      otp,
      password: validated.data.password,
    });
  } catch (error) {
    console.error("[auth] verifyPasswordResetOtp failed:", error);
    return { error: "Could not reset your password. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error || "Could not reset your password." };
  }
  redirect("/sign-in?reset=true");
}
