"use client";

import { useState } from "react";

interface UserAvatarEditorProps {
  avatarUrl?: string | null;
  displayName: string;
  onChange: (url: string) => void;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}

export function UserAvatarEditor({
  avatarUrl,
  displayName,
  onChange,
  onRemove,
  disabled = false
}: UserAvatarEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState(avatarUrl || "");
  const [imageError, setImageError] = useState(false);

  const initial = (displayName || "U").trim().charAt(0).toUpperCase();

  const handleApply = () => {
    setImageError(false);
    onChange(tempUrl.trim());
    setIsEditing(false);
  };

  const handleRemove = async () => {
    setTempUrl("");
    setImageError(false);
    await onRemove();
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4 text-center sm:w-48">
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#DCDAD0] bg-[#EAE8DD] text-[26px] font-bold text-[#55574F]">
        {avatarUrl && !imageError ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      <div className="w-full">
        <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">Profile Photo</p>
        <p className="text-[11px] text-[#92938B]">JPG, PNG, or GIF URL</p>
      </div>

      {!isEditing ? (
        <div className="flex w-full flex-col gap-1.5 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setTempUrl(avatarUrl || "");
              setIsEditing(true);
            }}
            className="rounded border border-[#D5D3C8] bg-white px-2.5 py-1 text-[12px] font-medium text-[#34352F] transition hover:bg-[#F2F1EA] disabled:opacity-50"
          >
            Change Photo
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              className="rounded px-2 py-1 text-[11px] text-[#A83232] transition hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <div className="w-full space-y-2 pt-1 text-left">
          <input
            type="url"
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full rounded border border-[#D5D3C8] bg-white px-2 py-1 text-[11px] text-[#252620] outline-none focus:border-[#8B806A]"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 rounded bg-[#1B1C18] py-1 text-[11px] font-semibold text-white hover:bg-[#34352F]"
            >
              Set
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 rounded border border-[#D5D3C8] bg-white py-1 text-[11px] text-[#55574F] hover:bg-[#F2F1EA]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
