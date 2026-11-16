"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolvePostAuthDestination } from "@/lib/auth/backend";

// Keep the existing server-side rate limit. Credentials remain outside browser code.
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"),
});

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
} | null;

async function rateLimit(key: string, message: string): Promise<AuthState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const { success } = await ratelimit.limit(`${key}_${ip}`);
  return success ? null : { error: message };
}

async function destinationOrError(accessToken: string): Promise<{ destination?: "/onboarding" | "/dashboard"; error?: string }> {
  try {
    return { destination: await resolvePostAuthDestination(accessToken) };
  } catch (error) {
    console.error("[auth] Could not prepare Foolioo workspace:", error);
    return { error: "Your account is authenticated, but we couldn't load your workspace. Please try signing in again." };
  }
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error || !data.session?.access_token) {
    if (error?.message?.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Email confirmation is still enabled in Supabase. Disable Confirm email in Authentication settings to allow sign-in without verification.",
      };
    }
    return { error: "Invalid email or password." };
  }

  const result = await destinationOrError(data.session.access_token);
  if (result.error || !result.destination) return { error: result.error ?? "Unable to load your workspace." };
  redirect(result.destination);
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

  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: { full_name: validated.data.name },
      ...(origin ? { emailRedirectTo: `${origin.replace(/\/$/, "")}/auth/callback` } : {}),
    },
  });

  if (error) {
    console.error("Supabase Signup Error:", error.message);
    const message = error.message.toLowerCase();
    if (message.includes("already registered") || message.includes("already exists")) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Could not create account. Please try again." };
  }

  // OTP verification is disabled for now. Password sign-up must receive a
  // Supabase session immediately so the user can enter the workspace.
  if (!data.session?.access_token) {
    return {
      error: "Your account was created, but Supabase is still requiring email confirmation. Disable Confirm email in Supabase Authentication settings, then sign in again.",
    };
  }

  const result = await destinationOrError(data.session.access_token);
  if (result.error || !result.destination) {
    return { error: result.error ?? "Your account was created, but we couldn't open your workspace." };
  }
  redirect(result.destination);
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
