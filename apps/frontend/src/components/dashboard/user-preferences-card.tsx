"use client";

import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";

export function UserPreferencesCard() {
  const { preferences, isLoading, updatePreferences, isSaving } = useUserProfile();

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [callAlerts, setCallAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (preferences) {
      if (preferences.theme) setTheme(preferences.theme);
      if (preferences.emailNotifications !== undefined) setEmailNotifications(preferences.emailNotifications);
      if (preferences.callAlerts !== undefined) setCallAlerts(preferences.callAlerts);
      if (preferences.weeklyReport !== undefined) setWeeklyReport(preferences.weeklyReport);
      if (preferences.audioPlaybackSpeed !== undefined) setPlaybackSpeed(preferences.audioPlaybackSpeed);
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      await updatePreferences({
        theme,
        emailNotifications,
        callAlerts,
        weeklyReport,
        audioPlaybackSpeed: playbackSpeed
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
    } catch {
      // handled by hook
    }
  };

  if (isLoading && !preferences) {
    return <div className="p-4 text-center text-[#777970]">Loading preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#E9E8E1] bg-white divide-y divide-[#F0EFE9]">
        {/* Email Notifications */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[14px] font-medium text-[#34352F]">Email Notifications</p>
            <p className="mt-0.5 text-[13px] text-[#92938B]">Receive updates when scheduled call batches conclude.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              disabled={isSaving}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-[#E5E4DC] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#1B1C18] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Call Alerts */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[14px] font-medium text-[#34352F]">Urgent Call Alerts</p>
            <p className="mt-0.5 text-[13px] text-[#92938B]">Alert on human handoff requests and high-sentiment inquiries.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={callAlerts}
              onChange={(e) => setCallAlerts(e.target.checked)}
              disabled={isSaving}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-[#E5E4DC] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#1B1C18] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Weekly Digest */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[14px] font-medium text-[#34352F]">Weekly Digest</p>
            <p className="mt-0.5 text-[13px] text-[#92938B]">Summary report of weekly call outcomes and conversion metrics.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={weeklyReport}
              onChange={(e) => setWeeklyReport(e.target.checked)}
              disabled={isSaving}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-[#E5E4DC] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#1B1C18] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Audio Playback Speed */}
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[14px] font-medium text-[#34352F]">Default Audio Playback Speed</p>
            <p className="mt-0.5 text-[13px] text-[#92938B]">Playback speed when reviewing call recordings.</p>
          </div>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            disabled={isSaving}
            className="rounded border border-[#E5E4DC] bg-white px-2.5 py-1 text-[13px] text-[#252620]"
          >
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x (Normal)</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {savedFeedback ? (
          <span className="text-[13px] font-medium text-[#31613B]">Preferences updated successfully.</span>
        ) : <span />}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-[#1B1C18] px-5 py-2 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition hover:bg-[#34352F] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Notification Preferences"}
        </button>
      </div>
    </div>
  );
}
