"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUserProfile,
  updateUserProfile,
  updateUserPreferences,
  deleteUserAvatar,
  type UserProfileData,
  type UserPreferences,
  type UpdateUserProfilePayload,
} from "@/lib/api/userProfile";

export interface UseUserProfileReturn {
  user: UserProfileData | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (payload: UpdateUserProfilePayload) => Promise<UserProfileData>;
  updatePreferences: (payload: UserPreferences) => Promise<UserPreferences>;
  removeAvatar: () => Promise<void>;
  isSaving: boolean;
  saveSuccess: boolean;
}

export function useUserProfile(): UseUserProfileReturn {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile();
      setUser(data.user);
      setPreferences(data.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleUpdateProfile = useCallback(async (payload: UpdateUserProfilePayload) => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateUserProfile(payload);
      setUser(updated);
      setSaveSuccess(true);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleUpdatePreferences = useCallback(async (payload: UserPreferences) => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateUserPreferences(payload);
      setPreferences(updated);
      setSaveSuccess(true);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update preferences";
      setError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await deleteUserAvatar();
      setUser((prev) => (prev ? { ...prev, avatarUrl: null } : null));
      setSaveSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove avatar";
      setError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    user,
    preferences,
    isLoading,
    error,
    refetch: loadProfile,
    updateProfile: handleUpdateProfile,
    updatePreferences: handleUpdatePreferences,
    removeAvatar: handleRemoveAvatar,
    isSaving,
    saveSuccess
  };
}
