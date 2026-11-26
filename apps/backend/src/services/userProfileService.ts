import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { users, clients, auditLog } from "@repo/db";
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

  // Merge metadata (bio, jobTitle, and custom metadata fields)
  const existingMeta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  let metadataChanged = false;
  const mergedMeta: Record<string, unknown> = { ...existingMeta };

  if (input.bio !== undefined) {
    mergedMeta.bio = input.bio;
    metadataChanged = true;
  }

  if (input.jobTitle !== undefined) {
    mergedMeta.jobTitle = input.jobTitle;
    metadataChanged = true;
  }

  if (input.metadata && typeof input.metadata === "object") {
    Object.assign(mergedMeta, input.metadata);
    metadataChanged = true;
  }

  if (metadataChanged) {
    updateFields.metadata = mergedMeta;
  }

  await db
    .update(users)
    .set(updateFields)
    .where(eq(users.id, userId));

  const refreshed = await getUserProfileService(userId);
  return refreshed ? refreshed.user : null;
}

export async function updateUserPreferencesService(
  userId: string,
  input: import("../types/userProfile.js").UpdateUserPreferencesInput
): Promise<UserPreferences | null> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const existingMeta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  const mergedMeta: Record<string, unknown> = { ...existingMeta };

  if (input.theme !== undefined) mergedMeta.theme = input.theme;
  if (input.emailNotifications !== undefined) mergedMeta.emailNotifications = input.emailNotifications;
  if (input.callAlerts !== undefined) mergedMeta.callAlerts = input.callAlerts;
  if (input.weeklyReport !== undefined) mergedMeta.weeklyReport = input.weeklyReport;
  if (input.audioPlaybackSpeed !== undefined) mergedMeta.audioPlaybackSpeed = input.audioPlaybackSpeed;
  if (input.locale !== undefined) mergedMeta.locale = input.locale;

  await db
    .update(users)
    .set({
      metadata: mergedMeta,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));

  const refreshed = await getUserProfileService(userId);
  return refreshed ? refreshed.preferences : null;
}

export async function removeUserAvatarService(userId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db
    .update(users)
    .set({
      avatarUrl: null,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));

  return true;
}

export async function updateWorkspaceNonVerifiedService(
  clientId: string,
  input: import("../types/userProfile.js").WorkspaceDetailsUpdateInput
): Promise<Record<string, unknown> | null> {
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const updateFields: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (input.name !== undefined && input.name.trim().length > 0) {
    updateFields.name = input.name.trim();
  }

  if (input.contactPersonName !== undefined) {
    updateFields.contactPersonName = input.contactPersonName ? input.contactPersonName.trim() : null;
  }

  if (input.timezone !== undefined && input.timezone.trim().length > 0) {
    updateFields.timezone = input.timezone.trim();
  }

  if (input.callingHoursStart !== undefined) {
    updateFields.callingHoursStart = input.callingHoursStart;
  }

  if (input.callingHoursEnd !== undefined) {
    updateFields.callingHoursEnd = input.callingHoursEnd;
  }

  if (input.metadata && typeof input.metadata === "object") {
    const existingMeta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
    updateFields.metadata = { ...existingMeta, ...input.metadata };
  }

  await db
    .update(clients)
    .set(updateFields)
    .where(eq(clients.id, clientId));

  const [updated] = await db
    .select({
      id: clients.id,
      name: clients.name,
      contactPersonName: clients.contactPersonName,
      timezone: clients.timezone,
      callingHoursStart: clients.callingHoursStart,
      callingHoursEnd: clients.callingHoursEnd,
      updatedAt: clients.updatedAt
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  return updated ? (updated as unknown as Record<string, unknown>) : null;
}

export async function recordUserAuditLog(
  userId: string,
  clientId: string | null,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId,
      clientId: clientId || null,
      action,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("[UserProfileService] Failed to record audit log:", err);
  }
}
