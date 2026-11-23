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
const AUTH_MAX_ATTEMPTS = 5;
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

  // 1. Direct Email + Password authentication via backend
  const result = await loginWithEmail({
    email: validated.data.email,
    password: validated.data.password,
  });

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
  redirect(dest.destination);
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

  // Direct backend registration: creates user, hashes password, sends 6-digit OTP from auth@foolioo.app
  const result = await registerWithEmail({
    name: validated.data.name,
    email: validated.data.email,
    password: validated.data.password,
  });

  if (!result.ok) {
    return { error: result.error || "Could not create account. Please try again." };
  }

  // Redirect to email OTP verification page
  redirect(`/verify-email?email=${encodeURIComponent(validated.data.email)}`);
}

export async function verifyOtpAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const limited = await rateLimit("verify_otp", "Too many verification attempts. Please try again in a minute.");
  if (limited) return limited;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const otp = String(formData.get("otp") ?? "").trim();

  if (!email || !otp) {
    return { error: "Please enter the 6-digit verification code." };
  }

  const result = await verifyAuthOtp(email, otp);
  if (!result.ok) {
    return { error: result.error || "Invalid or expired verification code." };
  }

  if (!result.token) {
    redirect("/sign-in?verified=true");
  }

  await setSessionCookie(result.token);

  const dest = await destinationOrError(result.token);
  if (dest.error || !dest.destination) {
    redirect("/dashboard");
  }
  redirect(dest.destination);
}

export async function resendOtpAction(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!email) return { ok: false, error: "Email address is required" };
  return requestAuthOtp(email);
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

  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { fieldErrors: { email: ["Please enter a valid email address."] } };
  }

  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  await supabase.auth.resetPasswordForEmail(email, {
    ...(origin ? { redirectTo: `${origin.replace(/\/$/, "")}/auth/callback?next=/reset-password` } : {}),
  });

  return { success: "If an account exists with this email, a password reset link has been sent." };
}

export async function resetPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const validated = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: validated.data.password });
  if (error) {
    return { error: "Failed to update password. Your session may have expired." };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/sign-in");

  const result = await destinationOrError(session.access_token);
  if (result.error || !result.destination) return { error: result.error ?? "Unable to load your workspace." };
  redirect(result.destination);
}
