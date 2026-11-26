export interface UserProfileData {
  id: string;
  clientId: string | null;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  emailNotifications?: boolean;
  callAlerts?: boolean;
  weeklyReport?: boolean;
  audioPlaybackSpeed?: number;
  locale?: string;
}

export interface UpdateUserProfilePayload {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
}

export interface UserProfileResponse {
  ok: boolean;
  user?: UserProfileData;
  preferences?: UserPreferences;
  message?: string;
  error?: string;
}

/**
 * Fetch authenticated user profile & preferences from the BFF proxy
 */
export async function fetchUserProfile(): Promise<{ user: UserProfileData; preferences: UserPreferences }> {
  const response = await fetch("/api/user/profile", {
    method: "GET",
    cache: "no-store",
    headers: {
      "Accept": "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to load profile");
  }

  return { user: data.user, preferences: data.preferences };
}

/**
 * Update non-verified profile fields (displayName, avatarUrl, bio, jobTitle).
 * Note: Phone numbers cannot be updated via this endpoint.
 */
export async function updateUserProfile(payload: UpdateUserProfilePayload): Promise<UserProfileData> {
  const response = await fetch("/api/user/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to update profile");
  }

  return data.user;
}

/**
 * Update user UI & notification preferences (theme, email alerts, call alerts).
 */
export async function updateUserPreferences(payload: UserPreferences): Promise<UserPreferences> {
  const response = await fetch("/api/user/preferences", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to update preferences");
  }

  return data.preferences;
}
