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
