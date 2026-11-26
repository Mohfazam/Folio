import type { Request, Response } from "express";
import {
  getUserProfileService,
  updateUserProfileService,
  updateUserPreferencesService,
  removeUserAvatarService,
  updateWorkspaceNonVerifiedService,
  recordUserAuditLog,
  sanitizeUserProfileResponse
} from "../services/userProfileService.js";
import {
  validateDisplayName,
  validateAvatarUrl,
  validateBio,
  validateJobTitle,
  validateTimezone,
  validateCallingHoursTime,
  validateUserPreferences,
  validateUserProfileUpdate,
  guardAgainstPhoneNumberChange,
  guardAgainstEmailChange
} from "../validators/userProfileValidators.js";

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile and non-sensitive preferences.
 */
export async function getUserProfileRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const data = await getUserProfileService(userId);
    if (!data) {
      res.status(404).json({ ok: false, error: "User profile not found" });
      return;
    }

    res.status(200).json({
      ok: true,
      user: sanitizeUserProfileResponse(data.user),
      preferences: data.preferences
    });
  } catch (error) {
    console.error("[UserProfileRoute] Error fetching user profile:", error);
    res.status(500).json({ ok: false, error: "Failed to retrieve user profile" });
  }
}

/**
 * PATCH /api/user/profile
 * Allows users to edit non-verified details (displayName, avatarUrl, bio, jobTitle).
 */
export async function updateUserProfileRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const validation = validateUserProfileUpdate(req.body);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    const updated = await updateUserProfileService(userId, validation.value || {});
    if (!updated) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    await recordUserAuditLog(userId, req.clientId || null, "user.profile.updated", {
      fields: Object.keys(validation.value || {})
    });

    res.status(200).json({
      ok: true,
      message: "Profile updated successfully",
      user: sanitizeUserProfileResponse(updated)
    });
  } catch (error) {
    console.error("[UserProfileRoute] Error updating user profile:", error);
    res.status(500).json({ ok: false, error: "Failed to update user profile" });
  }
}
