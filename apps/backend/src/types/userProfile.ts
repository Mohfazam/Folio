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
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  emailNotifications?: boolean;
  callAlerts?: boolean;
  weeklyReport?: boolean;
  audioPlaybackSpeed?: number;
  locale?: string;
}

export interface UpdateUserProfileInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserPreferencesInput {
  theme?: "light" | "dark" | "system";
  emailNotifications?: boolean;
  callAlerts?: boolean;
  weeklyReport?: boolean;
  audioPlaybackSpeed?: number;
  locale?: string;
}

export interface WorkspaceDetailsUpdateInput {
  name?: string;
  contactPersonName?: string | null;
  timezone?: string;
  callingHoursStart?: string;
  callingHoursEnd?: string;
  metadata?: Record<string, unknown>;
}
