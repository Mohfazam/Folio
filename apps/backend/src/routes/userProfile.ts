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

    // Explicit rejection guard: phone number changes require 2FA/OTP verification
    const phoneCheck = guardAgainstPhoneNumberChange((req.body || {}) as Record<string, unknown>);
    if (phoneCheck.rejected) {
      res.status(400).json({
        ok: false,
        error: phoneCheck.error,
        code: "PHONE_NUMBER_CHANGE_FORBIDDEN"
      });
      return;
    }

    // Explicit rejection guard: email address changes require verification
    const emailCheck = guardAgainstEmailChange((req.body || {}) as Record<string, unknown>);
    if (emailCheck.rejected) {
      res.status(400).json({
        ok: false,
        error: emailCheck.error,
        code: "EMAIL_CHANGE_FORBIDDEN"
      });
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

/**
 * PATCH /api/user/preferences
 * Allows users to update UI theme, notification toggles, and audio playback settings.
 */
export async function updateUserPreferencesRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const validation = validateUserPreferences(req.body);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    const updated = await updateUserPreferencesService(userId, validation.value || {});
    if (!updated) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    await recordUserAuditLog(userId, req.clientId || null, "user.preferences.updated", {
      preferences: validation.value
    });

    res.status(200).json({
      ok: true,
      message: "Preferences updated successfully",
      preferences: updated
    });
  } catch (error) {
    console.error("[UserProfileRoute] Error updating user preferences:", error);
    res.status(500).json({ ok: false, error: "Failed to update user preferences" });
  }
}

/**
 * DELETE /api/user/avatar
 * Removes the authenticated user's custom avatar URL.
 */
export async function deleteUserAvatarRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const removed = await removeUserAvatarService(userId);
    if (!removed) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    await recordUserAuditLog(userId, req.clientId || null, "user.avatar.removed");

    res.status(200).json({
      ok: true,
      message: "Avatar removed successfully"
    });
  } catch (error) {
    console.error("[UserProfileRoute] Error removing avatar:", error);
    res.status(500).json({ ok: false, error: "Failed to remove avatar" });
  }
}

/**
 * PATCH /api/user/workspace
 * Allows users to edit non-verified workspace details (name, contactPersonName, timezone, callingHours).
 * Strict guard: blocks any attempts to alter callerIdNumber or phone verification without OTP.
 */
export async function updateWorkspaceDetailsRoute(req: Request, res: Response): Promise<void> {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      res.status(400).json({ ok: false, error: "Active workspace required" });
      return;
    }

    const payload = (req.body || {}) as Record<string, unknown>;

    // Reject phone modifications on unverified route
    const phoneGuard = guardAgainstPhoneNumberChange(payload);
    if (phoneGuard.rejected) {
      res.status(400).json({
        ok: false,
        error: phoneGuard.error,
        code: "PHONE_NUMBER_CHANGE_FORBIDDEN"
      });
      return;
    }

    const input: import("../types/userProfile.js").WorkspaceDetailsUpdateInput = {};

    if ("name" in payload && payload.name !== undefined) {
      if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
        res.status(400).json({ ok: false, error: "Workspace name cannot be empty" });
        return;
      }
      input.name = payload.name.trim();
    }

    if ("contactPersonName" in payload && payload.contactPersonName !== undefined) {
      input.contactPersonName = typeof payload.contactPersonName === "string" ? payload.contactPersonName.trim() : null;
    }

    if ("timezone" in payload && payload.timezone !== undefined) {
      const tzRes = validateTimezone(payload.timezone);
      if (!tzRes.valid) {
        res.status(400).json({ ok: false, error: tzRes.error });
        return;
      }
      input.timezone = tzRes.value;
    }

    if ("callingHoursStart" in payload && payload.callingHoursStart !== undefined) {
      const timeRes = validateCallingHoursTime(payload.callingHoursStart);
      if (!timeRes.valid) {
        res.status(400).json({ ok: false, error: timeRes.error });
        return;
      }
      input.callingHoursStart = timeRes.value;
    }

    if ("callingHoursEnd" in payload && payload.callingHoursEnd !== undefined) {
      const timeRes = validateCallingHoursTime(payload.callingHoursEnd);
      if (!timeRes.valid) {
        res.status(400).json({ ok: false, error: timeRes.error });
        return;
      }
      input.callingHoursEnd = timeRes.value;
    }

    const updated = await updateWorkspaceNonVerifiedService(clientId, input);
    if (!updated) {
      res.status(404).json({ ok: false, error: "Workspace not found" });
      return;
    }

    if (req.userId) {
      await recordUserAuditLog(req.userId, clientId, "workspace.non_verified.updated", {
        fields: Object.keys(input)
      });
    }

    res.status(200).json({
      ok: true,
      message: "Workspace details updated successfully",
      workspace: updated
    });
  } catch (error) {
    console.error("[UserProfileRoute] Error updating workspace details:", error);
    res.status(500).json({ ok: false, error: "Failed to update workspace details" });
  }
}
