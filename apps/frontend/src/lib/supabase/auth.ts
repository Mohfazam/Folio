import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

export async function getCurrentUser(
  supabase: ReturnType<typeof createClient> = createClient(),
): Promise<User | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error?.name === "AuthSessionMissingError") return null;
  if (error) throw error;
  return user;
}
