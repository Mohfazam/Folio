import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { users } from "@repo/db";
import type { UserProfileData, UserPreferences } from "../types/userProfile.js";

export async function getUserProfileService(userId: string): Promise<{
  user: UserProfileData;
  preferences: UserPreferences;
} | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;

  const user: UserProfileData = {
    id: row.id,
    clientId: row.clientId,
    displayName: row.displayName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    phoneVerified: Boolean(row.phoneNumber),
    emailVerified: Boolean(row.email),
    avatarUrl: row.avatarUrl,
    bio: typeof meta.bio === "string" ? meta.bio : null,
    jobTitle: typeof meta.jobTitle === "string" ? meta.jobTitle : null,
    role: row.role || "user",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };

  const preferences: UserPreferences = {
    theme: meta.theme === "light" || meta.theme === "dark" || meta.theme === "system" ? meta.theme : "system",
    emailNotifications: typeof meta.emailNotifications === "boolean" ? meta.emailNotifications : true,
    callAlerts: typeof meta.callAlerts === "boolean" ? meta.callAlerts : true,
    weeklyReport: typeof meta.weeklyReport === "boolean" ? meta.weeklyReport : false,
    audioPlaybackSpeed: typeof meta.audioPlaybackSpeed === "number" ? meta.audioPlaybackSpeed : 1.0,
    locale: typeof meta.locale === "string" ? meta.locale : "en-US"
  };

  return { user, preferences };
}

export async function updateUserProfileService(
  userId: string,
  input: import("../types/userProfile.js").UpdateUserProfileInput
): Promise<UserProfileData | null> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const updateFields: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (input.displayName !== undefined) {
    updateFields.displayName = input.displayName;
  }

  if (input.avatarUrl !== undefined) {
    updateFields.avatarUrl = input.avatarUrl;
  }

  await db
    .update(users)
    .set(updateFields)
    .where(eq(users.id, userId));

  const refreshed = await getUserProfileService(userId);
  return refreshed ? refreshed.user : null;
}
