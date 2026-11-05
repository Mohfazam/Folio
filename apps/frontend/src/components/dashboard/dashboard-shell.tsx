"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IconName =
  | "overview"
  | "campaigns"
  | "contacts"
  | "calls"
  | "followups"
  | "knowledge"
  | "analytics"
  | "search"
  | "settings"
  | "arrow"
  | "close";

export type DashboardProfile = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  workspaceName: string;
  workspaceId: string | null;
  timezone: string;
  greeting: "Good morning" | "Good afternoon" | "Good evening";
  planName: string | null;
  trialDaysLeft: number | null;
  isTrial: boolean;
};

type DashboardShellProps = {
  profile: DashboardProfile;
  children: ReactNode;
};

const DashboardProfileContext = createContext<DashboardProfile | null>(null);

export function useDashboardProfile() {
  const value = useContext(DashboardProfileContext);
  if (!value) {
    throw new Error("useDashboardProfile must be used inside DashboardShell");
  }
  return value;
}

const NAV_ITEMS: Array<{
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
}> = [
  { label: "Overview", href: "/dashboard", icon: "overview", enabled: true },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: "campaigns", enabled: false },
  { label: "Contacts", href: "/dashboard/contacts", icon: "contacts", enabled: false },
  { label: "Calls", href: "/dashboard/calls", icon: "calls", enabled: false },
  { label: "Follow-ups", href: "/dashboard/follow-ups", icon: "followups", enabled: false },
  { label: "Knowledge & Voice", href: "/dashboard/knowledge-voice", icon: "knowledge", enabled: false },
  { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", enabled: false },
];

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  let artwork: ReactNode;
  switch (name) {
    case "overview":
      artwork = <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>;
      break;
    case "campaigns":
      artwork = <><path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-6" /><path d="M7 9 19 4v16L7 15z" /><path d="M19 9h2a2 2 0 0 1 0 4h-2" /></>;
      break;
    case "contacts":
      artwork = <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5" /><path d="M17 5.5a3 3 0 0 1 0 5.8M18 15c2 .5 3 2 3 4" /></>;
      break;
    case "calls":
      artwork = <><path d="M6.5 3.5h3l1.5 4-2 1.8a15 15 0 0 0 5.7 5.7l1.8-2 4 1.5v3c0 1.1-.9 2-2 2A15.5 15.5 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z" /></>;
      break;
    case "followups":
      artwork = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" /></>;
      break;
    case "knowledge":
      artwork = <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5V22M8 7h8M8 11h8" /></>;
      break;
    case "analytics":
      artwork = <><path d="M3 20V4M3 20h18" /><path d="m6 15 4-4 3 2 6-7" /><path d="M16 6h3v3" /></>;
      break;
    case "search":
      artwork = <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>;
      break;
    case "settings":
      artwork = <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.1l-.2.1-3.3-.1-.1-.2a1.7 1.7 0 0 0-1.4-1l-.2-.1-1.7-2.8.1-.2a1.7 1.7 0 0 0-.2-1.9l-.1-.2.1-3.3.2-.1a1.7 1.7 0 0 0 1-1.4l.1-.2 2.8-1.7.2.1a1.7 1.7 0 0 0 1.9-.2l.2-.1 3.3.1.1.2a1.7 1.7 0 0 0 1.4 1l.2.1 1.7 2.8-.1.2a1.7 1.7 0 0 0 .2 1.9l.1.2-.1 1.9z" /></>;
      break;
    case "arrow":
      artwork = <><path d="M5 12h14M13 6l6 6-6 6" /></>;
      break;
    case "close":
      artwork = <><path d="m6 6 12 12M18 6 6 18" /></>;
      break;
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      {artwork}
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="flex h-8 items-center gap-2.5 whitespace-nowrap" aria-label="Foolioo">
      <Image
        src="/Foolioo.svg"
        alt=""
        width={26}
        height={26}
        priority
        className="h-[26px] w-[26px] shrink-0"
      />
      <span className="font-['Newsreader'] text-[25px] font-semibold italic leading-none tracking-[-0.7px] text-[#1B1C18]">
        folioo<span className="text-[#F27B65]">.</span>
      </span>
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function NavEntry({
  item,
  active,
  variant = "sidebar",
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  variant?: "sidebar" | "mobile";
}) {
  const isMobile = variant === "mobile";
  const className = [
    "flex w-full rounded-[4px] font-['Space_Grotesk'] transition-colors",
    isMobile
      ? "min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px]"
      : "items-center gap-3 px-3 py-2 text-left text-[14px] md:justify-center md:px-0 lg:justify-start lg:px-3",
    active ? "bg-[#E9E8E1] font-semibold text-[#1B1C18]" : "text-[#444748]",
    item.enabled ? "hover:bg-[#ECEBE4]" : "cursor-default text-[#747878]",
  ].join(" ");

  const content = (
    <>
      <Icon name={item.icon} className="h-[15px] w-[15px] shrink-0" />
      <span className={isMobile ? "max-w-full truncate" : "hidden min-w-0 truncate lg:inline"}>{item.label}</span>
    </>
  );

  if (item.enabled) {
    return (
      <Link href={item.href} aria-current={active ? "page" : undefined} className={className} title={!isMobile ? item.label : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <div aria-disabled="true" title={`${item.label} is not part of this dashboard pass`} className={className}>
      {content}
    </div>
  );
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query));
  }, [searchQuery]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Unable to sign out.");
      setSigningOut(false);
    }
  };

  const trialCopy = profile.trialDaysLeft !== null
    ? `${profile.trialDaysLeft} ${profile.trialDaysLeft === 1 ? "day" : "days"} left in your trial`
    : profile.isTrial
      ? "Your trial workspace"
      : "Workspace plan";

  return (
    <DashboardProfileContext.Provider value={profile}>
      <div className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
        <header className="fixed inset-x-0 top-0 z-40 h-14 bg-[rgba(251,249,242,0.84)] px-2 pt-[7px] backdrop-blur-xl">
          <div className="flex h-[50px] items-center justify-between gap-3 rounded-[8px] border border-[rgba(100,74,187,0.2)] bg-[#E7DEFF] px-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:px-[17px]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden min-w-0 items-center gap-2 text-[13px] leading-[18px] sm:flex">
                <span className="font-semibold text-[#1B1C18]">{trialCopy}</span>
                {profile.planName ? (
                  <span className="hidden text-[#4C30A2] md:inline">· {profile.planName} plan</span>
                ) : null}
              </div>
              <span className="truncate font-['Space_Grotesk'] text-[12px] text-[#4C30A2] sm:hidden">
                {profile.planName ?? "Workspace"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {profile.planName ? (
                <span className="hidden rounded-[12px] bg-white/70 px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#4C30A2] sm:inline-flex">
                  {profile.planName} plan
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-label="Open account menu"
                aria-expanded={profileOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#644ABB]/20 bg-white font-['Space_Grotesk'] text-[11px] font-semibold text-[#4C30A2] transition-colors hover:bg-[#F8F5FF]"
              >
                {initials(profile.displayName)}
              </button>
            </div>
          </div>

          {profileOpen ? (
            <div className="absolute right-2 top-[62px] z-50 w-[248px] rounded-[8px] border border-[#E9E8E1] bg-white p-3 shadow-[0_8px_32px_rgba(27,28,24,0.12)] sm:right-4">
              <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{profile.displayName}</p>
              <p className="mt-0.5 truncate font-['Space_Grotesk'] text-[11px] text-[#747878]">{profile.email}</p>
              <div className="my-3 h-px bg-[#E9E8E1]" />
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full rounded-[4px] px-2 py-2 text-left font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18] hover:bg-[#F5F4ED] disabled:opacity-50"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
              {signOutError ? <p className="mt-2 text-[11px] text-[#B42318]">{signOutError}</p> : null}
            </div>
          ) : null}
        </header>

        <aside className="fixed bottom-6 left-0 top-14 z-30 hidden w-[72px] flex-col justify-between bg-[#F5F4ED] px-2 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] md:flex lg:w-[208px] lg:px-3">
          <div className="flex flex-col gap-6">
            <Link href="/dashboard" className="flex min-h-7 items-center gap-2.5 px-2" aria-label="Foolioo overview">
              <BrandMark />
            </Link>

            <nav aria-label="Main navigation" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))}
                  variant="sidebar"
                />
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left font-['Space_Grotesk'] text-[13px] text-[#444748] transition-colors hover:bg-[#ECEBE4] md:justify-center lg:justify-start"
              title="Search (Ctrl or Cmd + K)"
            >
              <Icon name="search" className="h-[15px] w-[15px] shrink-0" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="ml-auto hidden rounded border border-[#D8D8D1] px-1 py-0.5 text-[9px] text-[#747878] lg:inline">⌘K</kbd>
            </button>
            <div aria-disabled="true" title="Settings is not part of this dashboard pass" className="flex cursor-default items-center gap-3 rounded-[4px] px-3 py-2 font-['Space_Grotesk'] text-[13px] text-[#747878] md:justify-center lg:justify-start">
              <Icon name="settings" className="h-[15px] w-[15px] shrink-0" />
              <span className="hidden lg:inline">Settings</span>
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex w-full items-center gap-3 rounded-[8px] bg-[#ECEBE4] px-2 py-2 text-left transition-colors hover:bg-[#E5E4DC] md:justify-center lg:justify-start"
              aria-label="Open account menu"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#1B1C18] font-['Space_Grotesk'] text-[11px] font-semibold text-white">
                {initials(profile.displayName)}
              </span>
              <span className="hidden min-w-0 flex-1 lg:block">
                <span className="block truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{profile.displayName}</span>
                <span className="block truncate font-['Space_Grotesk'] text-[10px] text-[#747878]">{profile.email}</span>
              </span>
            </button>
          </div>
        </aside>

        <main className="min-h-screen pb-24 pt-14 md:pb-8 md:pl-[72px] lg:pl-[208px]">
          <div className="mx-auto w-full max-w-[1088px] px-4 pb-8 pt-6 sm:px-6 sm:pt-8 lg:px-6 lg:pt-14">
            <div className="rounded-[12px] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:p-7 lg:p-8">
              {children}
            </div>
          </div>
        </main>

        <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#E9E8E1] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden">
          {NAV_ITEMS.slice(0, 4).map((item) => (
            <NavEntry
              key={item.href}
              item={item}
              active={pathname === item.href}
              variant="mobile"
            />
          ))}
        </nav>

        {searchOpen ? (
          <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1B1C18]/25 px-4 pt-[15vh]" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}>
            <div className="w-full max-w-[520px] overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white shadow-[0_20px_64px_rgba(27,28,24,0.18)]">
              <div className="flex items-center gap-3 border-b border-[#E9E8E1] px-4 py-3">
                <Icon name="search" className="h-4 w-4 text-[#747878]" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search Foolioo"
                  className="min-w-0 flex-1 bg-transparent font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none placeholder:text-[#A0A3A2]"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="rounded p-1 text-[#747878] hover:bg-[#F5F4ED]" aria-label="Close search">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {filteredItems.map((item) => (
                  <div key={item.href} className="flex items-center justify-between rounded-[5px] px-3 py-2.5">
                    <span className="flex items-center gap-3 font-['Space_Grotesk'] text-[13px] text-[#1B1C18]">
                      <Icon name={item.icon} className="h-4 w-4 text-[#747878]" />
                      {item.label}
                    </span>
                    {item.enabled ? (
                      <Link href={item.href} onClick={() => setSearchOpen(false)} className="font-['Space_Grotesk'] text-[11px] font-medium text-[#644ABB]">Open</Link>
                    ) : (
                      <span className="font-['Space_Grotesk'] text-[10px] text-[#929493]">Coming soon</span>
                    )}
                  </div>
                ))}
                {filteredItems.length === 0 ? <p className="px-3 py-5 text-center font-['Space_Grotesk'] text-[12px] text-[#747878]">No matching sections.</p> : null}
              </div>
              <div className="border-t border-[#E9E8E1] px-4 py-2 font-['Space_Grotesk'] text-[10px] text-[#929493]">Navigate to sections available in this workspace</div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardProfileContext.Provider>
  );
}
