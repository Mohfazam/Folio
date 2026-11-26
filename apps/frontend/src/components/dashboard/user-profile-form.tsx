"use client";

import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { UserAvatarEditor } from "./user-avatar-editor";

const inputClass =
  "mt-1.5 w-full rounded-md border border-[#E5E4DC] bg-white px-3 py-2.5 text-[14px] text-[#252620] outline-none transition focus:border-[#8B806A] focus:ring-2 focus:ring-[#8B806A]/10";
const labelClass = "text-[13px] font-semibold uppercase tracking-[0.07em] text-[#777970]";

export function UserProfileForm({ fallbackName, fallbackEmail }: { fallbackName?: string; fallbackEmail?: string }) {
  const { user, isLoading, error, updateProfile, removeAvatar, isSaving, saveSuccess } = useUserProfile();

  const [displayName, setDisplayName] = useState(user?.displayName || fallbackName || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.displayName) setDisplayName(user.displayName);
      if (user.jobTitle) setJobTitle(user.jobTitle);
      if (user.bio) setBio(user.bio);
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalFeedback(null);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        jobTitle: jobTitle.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null
      });
      setLocalFeedback("Profile saved successfully.");
      setTimeout(() => setLocalFeedback(null), 3000);
    } catch (err) {
      setLocalFeedback(err instanceof Error ? err.message : "Failed to update profile.");
    }
  };

  if (isLoading && !user) {
    return (
      <div className="py-8 text-center">
        <p className="text-[14px] text-[#777970]">Loading your profile details...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <UserAvatarEditor
          avatarUrl={avatarUrl}
          displayName={displayName || fallbackName || "User"}
          onChange={setAvatarUrl}
          onRemove={async () => {
            setAvatarUrl("");
            await removeAvatar();
          }}
          disabled={isSaving}
        />

        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block">
              <span className={labelClass}>Display Name</span>
              <input
                type="text"
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
                required
              />
            </label>
            <span className="mt-1 block text-[12px] text-[#92938B]">This name is visible to teammates and workspace admins.</span>
          </div>

          <div>
            <label className="block">
              <span className={labelClass}>Job Title / Role</span>
              <input
                type="text"
                className={inputClass}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Admissions Director"
                maxLength={100}
              />
            </label>
            <span className="mt-1 block text-[12px] text-[#92938B]">Your operational role within the organization.</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block">
          <span className={labelClass}>Bio & Notes</span>
          <textarea
            rows={3}
            className={inputClass}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short note or bio about your role and responsibilities..."
            maxLength={500}
          />
        </label>
        <div className="mt-1 flex justify-between text-[12px] text-[#92938B]">
          <span>Non-verified description field.</span>
          <span>{bio.length} / 500</span>
        </div>
      </div>

      {/* Verified security boundary notices */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Phone Number</span>
            <span className="rounded-full bg-[#E7F2E8] px-2 py-0.5 text-[11px] font-semibold text-[#31613B]">
              Verified (Protected)
            </span>
          </div>
          <p className="mt-2 font-['Space_Grotesk'] text-[14.5px] font-medium text-[#1B1C18]">
            {user?.phoneNumber || "No phone number attached"}
          </p>
          <p className="mt-1 text-[12px] text-[#858782]">
            Phone numbers cannot be edited on this endpoint. Modifying phone numbers requires OTP verification.
          </p>
        </div>

        <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Email Address</span>
            <span className="rounded-full bg-[#ECEBE4] px-2 py-0.5 text-[11px] font-semibold text-[#55574F]">
              Primary Email
            </span>
          </div>
          <p className="mt-2 break-all font-['Space_Grotesk'] text-[14.5px] font-medium text-[#1B1C18]">
            {user?.email || fallbackEmail || "Not available"}
          </p>
          <p className="mt-1 text-[12px] text-[#858782]">
            Email modifications require security confirmation and cannot be changed here.
          </p>
        </div>
      </div>

      {(error || localFeedback) && (
        <div
          className={`rounded-md px-3.5 py-2.5 text-[13px] ${
            saveSuccess || localFeedback?.includes("success")
              ? "bg-[#EBF5ED] text-[#285732] border border-[#C5E3CA]"
              : "bg-[#FDF2F2] text-[#9E2A2B] border border-[#F5C2C2]"
          }`}
        >
          {localFeedback || error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition hover:bg-[#34352F] disabled:opacity-50"
        >
          {isSaving ? "Saving changes..." : "Save Profile Details"}
        </button>
      </div>
    </form>
  );
}
