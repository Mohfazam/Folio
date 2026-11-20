"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  trialEndsAt: string | null;
  trialExpired: boolean;
  isTrial: boolean;
};

type DashboardShellProps = {
  profile: DashboardProfile;
  children: ReactNode;
};

export type DashboardSetupAction = "voice" | "contacts" | "test-call" | "campaign" | "routing" | "launch";

type DashboardNavigationContextValue = {
  requestedSetupAction: DashboardSetupAction | null;
  clearRequestedSetupAction: () => void;
};

const DashboardProfileContext = createContext<DashboardProfile | null>(null);
const DashboardNavigationContext = createContext<DashboardNavigationContextValue | null>(null);

export function useDashboardProfile() {
  const value = useContext(DashboardProfileContext);
  if (!value) {
    throw new Error("useDashboardProfile must be used inside DashboardShell");
  }
  return value;
}

export function useDashboardNavigation() {
  const value = useContext(DashboardNavigationContext);
  if (!value) {
    throw new Error("useDashboardNavigation must be used inside DashboardShell");
  }
  return value;
}

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
  group: "primary" | "operations" | "intelligence";
  setupAction?: DashboardSetupAction;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "overview", enabled: true, group: "primary" },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: "campaigns", enabled: true, group: "operations" },
  { label: "Contacts", href: "/dashboard/contacts", icon: "contacts", enabled: true, group: "operations" },
  { label: "Calls", href: "/dashboard/calls", icon: "calls", enabled: true, group: "operations" },
  { label: "Follow-ups", href: "/dashboard/follow-ups", icon: "followups", enabled: true, group: "operations" },
  { label: "AI Studio", href: "/dashboard/ai-studio", icon: "knowledge", enabled: true, group: "intelligence" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", enabled: true, group: "intelligence" },
];

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.65,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  let artwork: ReactNode;
  switch (name) {
    case "overview":
      artwork = <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>;
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
      <span className="hidden font-['Newsreader'] text-[25px] font-semibold italic leading-none tracking-[-0.7px] text-[#1B1C18] lg:inline">
        Foolioo
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
  onSetupAction,
}: {
  item: NavItem;
  active: boolean;
  variant?: "sidebar" | "mobile";
  onSetupAction?: (action: DashboardSetupAction) => void;
}) {
  const isMobile = variant === "mobile";
  const [shouldPrefetch, setShouldPrefetch] = useState(false);
  const warmRoute = () => setShouldPrefetch(true);

  const className = [
    "group flex w-full font-['Space_Grotesk'] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]",
    isMobile
      ? "min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] px-1 py-1.5 text-center text-[10px]"
      : "items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13.5px] md:justify-center md:px-0 lg:justify-start lg:px-3",
    active
      ? isMobile
        ? "bg-[#EFEAFB] font-semibold text-[#644ABB]"
        : "border border-[#E6E4DC] bg-white font-semibold text-[#644ABB] shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      : "border border-transparent font-medium text-[#444748]",
    item.enabled || item.setupAction
      ? active
        ? ""
        : "hover:bg-[#ECEBE4]/80 hover:text-[#1B1C18]"
      : "cursor-default text-[#747878]",
  ].join(" ");

  const content = (
    <>
      <Icon
        name={item.icon}
        className={`h-4 w-4 shrink-0 transition-colors ${
          active ? "text-[#644ABB]" : "text-[#666A68] group-hover:text-[#1B1C18]"
        }`}
      />
      <span className={isMobile ? "max-w-full truncate" : "hidden min-w-0 truncate lg:inline"}>
        {item.label}
      </span>
    </>
  );

  if (item.enabled) {
    return (
      <Link
        href={item.href}
        prefetch={shouldPrefetch}
        onMouseEnter={warmRoute}
        onFocus={warmRoute}
        onTouchStart={warmRoute}
        aria-current={active ? "page" : undefined}
        className={className}
        title={!isMobile ? item.label : undefined}
      >
        {content}
      </Link>
    );
  }

  if (item.setupAction) {
    return (
      <button
        type="button"
        onClick={() => onSetupAction?.(item.setupAction!)}
        className={className}
        title={`Open ${item.label.toLowerCase()} setup`}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-disabled="true" title={`${item.label} is not available yet`} className={className}>
      {content}
    </div>
  );
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"workspace" | "plan">("workspace");
  const [copiedWorkspaceId, setCopiedWorkspaceId] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [requestedSetupAction, setRequestedSetupAction] = useState<DashboardSetupAction | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query));
  }, [searchQuery]);

  const primaryItems = useMemo(() => NAV_ITEMS.filter((item) => item.group === "primary"), []);
  const operationsItems = useMemo(() => NAV_ITEMS.filter((item) => item.group === "operations"), []);
  const intelligenceItems = useMemo(() => NAV_ITEMS.filter((item) => item.group === "intelligence"), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSettingsOpen(false);
        setUserMenuOpen(false);
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

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

  const trialDays = profile.trialDaysLeft;
  const upgradeCardHeadline = profile.trialExpired
    ? "Your trial has ended. Select a plan to continue."
    : trialDays !== null && trialDays <= 3
      ? `Only ${trialDays} ${trialDays === 1 ? "day" : "days"} left in your trial.`
      : "Upgrade & unlock all features.";

  const upgradeCardAction = profile.trialExpired ? "Select a Plan" : "Upgrade Foolioo";

  const openSetupAction = (action: DashboardSetupAction) => {
    setRequestedSetupAction(action);
    setSearchOpen(false);
  };

  const clearRequestedSetupAction = useCallback(() => setRequestedSetupAction(null), []);

  const copyWorkspaceId = async () => {
    if (!profile.workspaceId) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(profile.workspaceId);
      setCopiedWorkspaceId(true);
    } catch {
      setCopiedWorkspaceId(false);
      setCopyError("Clipboard access is unavailable in this browser.");
    }
  };

  const isRouteActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <DashboardProfileContext.Provider value={profile}>
      <DashboardNavigationContext.Provider value={{ requestedSetupAction, clearRequestedSetupAction }}>
        <div className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
          {/* Fixed Desktop & Tablet Sidebar */}
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col justify-between border-r border-[#E9E8E1] bg-[#F5F4ED] px-2.5 py-4 md:flex lg:w-[232px] lg:px-3.5">
            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              {/* Original Foolioo Branding at the top as before */}
              <Link
                href="/dashboard"
                className="flex min-h-8 items-center gap-2.5 rounded-[6px] px-2 md:justify-center lg:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                aria-label="Foolioo overview"
              >
                <BrandMark />
              </Link>

              {/* Grouped Navigation Tabs */}
              <nav aria-label="Main navigation" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  {primaryItems.map((item) => (
                    <NavEntry
                      key={item.href}
                      item={item}
                      active={isRouteActive(item.href)}
                      variant="sidebar"
                      onSetupAction={openSetupAction}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="group flex w-full items-center gap-3 rounded-[8px] border border-transparent px-3 py-2 text-left font-['Space_Grotesk'] text-[13.5px] font-medium text-[#444748] transition-colors hover:bg-[#ECEBE4]/80 hover:text-[#1B1C18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] md:justify-center md:px-0 lg:justify-start lg:px-3"
                    title="Search (Ctrl or Cmd + K)"
                  >
                    <Icon name="search" className="h-4 w-4 shrink-0 text-[#666A68] group-hover:text-[#1B1C18]" />
                    <span className="hidden lg:inline">Search</span>
                    <kbd className="ml-auto hidden rounded-[5px] border border-[#DFDDD4] bg-white px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#747878] lg:inline">
                      ⌘ K
                    </kbd>
                  </button>
                </div>

                {/* Operations Group */}
                <div className="flex flex-col gap-1 border-t border-[#E6E5DD] pt-3">
                  <p className="hidden px-3 pb-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#8E918B] lg:block">
                    OPERATIONS
                  </p>
                  {operationsItems.map((item) => (
                    <NavEntry
                      key={item.href}
                      item={item}
                      active={isRouteActive(item.href)}
                      variant="sidebar"
                      onSetupAction={openSetupAction}
                    />
                  ))}
                </div>

                {/* Intelligence Group */}
                <div className="flex flex-col gap-1 border-t border-[#E6E5DD] pt-3">
                  <p className="hidden px-3 pb-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#8E918B] lg:block">
                    INTELLIGENCE
                  </p>
                  {intelligenceItems.map((item) => (
                    <NavEntry
                      key={item.href}
                      item={item}
                      active={isRouteActive(item.href)}
                      variant="sidebar"
                      onSetupAction={openSetupAction}
                    />
                  ))}

                  <Link
                    href="/dashboard/settings"
                    aria-current={isRouteActive("/dashboard/settings") ? "page" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-[8px] px-3 py-2 font-['Space_Grotesk'] text-[13.5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] md:justify-center md:px-0 lg:justify-start lg:px-3 ${
                      isRouteActive("/dashboard/settings")
                        ? "border border-[#E6E4DC] bg-white font-semibold text-[#644ABB] shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
                        : "border border-transparent font-medium text-[#444748] hover:bg-[#ECEBE4]/80 hover:text-[#1B1C18]"
                    }`}
                    title="Settings"
                  >
                    <Icon
                      name="settings"
                      className={`h-4 w-4 shrink-0 ${
                        isRouteActive("/dashboard/settings")
                          ? "text-[#644ABB]"
                          : "text-[#666A68] group-hover:text-[#1B1C18]"
                      }`}
                    />
                    <span className="hidden lg:inline">Settings</span>
                  </Link>
                </div>
              </nav>
            </div>

            {/* Bottom Section: Upgrade Foolioo Card + User Profile Switcher below it */}
            <div className="flex flex-col gap-2.5 pt-3">
              {profile.isTrial ? (
                <div
                  className={`rounded-[12px] border p-3 shadow-[0_1px_3px_rgba(27,28,24,0.035)] ${
                    profile.trialExpired
                      ? "border-[#F0D8D4] bg-[#FFF8F7]"
                      : "border-[#E6E4DC] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] ${
                        profile.trialExpired ? "text-[#A33A32]" : "text-[#8E918B]"
                      }`}
                    >
                      {profile.trialExpired ? "Trial Expired" : "Trial Status"}
                    </span>
                    {trialDays !== null ? (
                      <span
                        className={`hidden rounded-full px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold lg:inline-block ${
                          profile.trialExpired
                            ? "bg-[#FBE8E6] text-[#A33A32]"
                            : trialDays <= 3
                              ? "bg-[#FFFAEC] text-[#8A6826]"
                              : "bg-[#EFEAFB] text-[#644ABB]"
                        }`}
                      >
                        {profile.trialExpired ? "Expired" : `${trialDays}d left`}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 hidden font-['Space_Grotesk'] text-[12px] font-medium leading-[1.35] text-[#1B1C18] lg:block">
                    {upgradeCardHeadline}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsSection("plan");
                      setSettingsOpen(true);
                    }}
                    className={`mt-2 hidden items-center gap-1 rounded font-['Space_Grotesk'] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] lg:inline-flex ${
                      profile.trialExpired
                        ? "text-[#A33A32] hover:text-[#852F29]"
                        : "text-[#644ABB] hover:text-[#4C30A2]"
                    }`}
                  >
                    <span>{upgradeCardAction}</span>
                    <span aria-hidden="true">›</span>
                  </button>

                  {/* Compact trigger for collapsed tablet sidebar */}
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsSection("plan");
                      setSettingsOpen(true);
                    }}
                    title={upgradeCardAction}
                    aria-label={upgradeCardAction}
                    className="mt-2 flex w-full items-center justify-center rounded-[6px] bg-[#EFEAFB] py-1 text-[10px] font-bold text-[#644ABB] lg:hidden"
                  >
                    Pro
                  </button>
                </div>
              ) : null}

              {/* User Profile Card & Account Menu moved below Upgrade Foolioo */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open user menu"
                  title="Your profile & options"
                  className={`flex w-full items-center gap-2.5 rounded-[10px] border border-[#E6E4DC] px-2.5 py-2.5 text-left transition-colors hover:bg-[#ECEBE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] md:justify-center lg:justify-start ${
                    userMenuOpen || isRouteActive("/dashboard/profile")
                      ? "bg-[#E9E8E1]"
                      : "bg-white/80"
                  }`}
                >
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      width={30}
                      height={30}
                      unoptimized
                      className="h-[30px] w-[30px] shrink-0 rounded-[7px] object-cover"
                    />
                  ) : (
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-[#1B1C18] font-['Space_Grotesk'] text-[11px] font-semibold text-white">
                      {initials(profile.displayName)}
                    </span>
                  )}
                  <span className="hidden min-w-0 flex-1 lg:block">
                    <span className="block truncate font-['Space_Grotesk'] text-[12.5px] font-semibold text-[#1B1C18]">
                      {profile.displayName}
                    </span>
                    <span className="block truncate font-['Space_Grotesk'] text-[10px] text-[#747878]">
                      {profile.email}
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    className={`hidden h-3.5 w-3.5 shrink-0 text-[#747878] transition-transform lg:block ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10l4-4 4 4" />
                  </svg>
                </button>

                {/* Popover Menu opening upward above User Profile */}
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white p-1.5 shadow-[0_12px_36px_rgba(27,28,24,0.14)] md:left-full md:bottom-0 md:mb-0 md:ml-2.5 lg:bottom-full lg:left-0 lg:mb-2 lg:ml-0"
                  >
                    <div className="border-b border-[#F0EFEA] px-3 py-2">
                      <p className="truncate font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                        {profile.displayName}
                      </p>
                      <p className="truncate font-['Space_Grotesk'] text-[10px] text-[#747878]">
                        {profile.email}
                      </p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/dashboard/profile"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#24251F] transition-colors hover:bg-[#F5F4ED]"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#747878]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="5" r="3" />
                          <path d="M2.5 14c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5" />
                        </svg>
                        Your Profile
                      </Link>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setSettingsSection("workspace");
                          setSettingsOpen(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#24251F] transition-colors hover:bg-[#F5F4ED]"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#747878]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="12" height="12" rx="2" />
                          <path d="M2 6h12M6 2v12" />
                        </svg>
                        Workspace Settings
                      </button>
                    </div>

                    <div className="border-t border-[#F0EFEA] pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleSignOut();
                        }}
                        disabled={signingOut}
                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] font-semibold text-[#A33A32] transition-colors hover:bg-[#FDF2F1] disabled:opacity-50"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#A33A32]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
                          <path d="M11 11l3-3-3-3" />
                          <path d="M14 8H6" />
                        </svg>
                        {signingOut ? "Signing out..." : "Log out"}
                      </button>
                      {signOutError ? (
                        <p className="px-3 py-1 font-['Space_Grotesk'] text-[10px] text-[#A33A32]">
                          {signOutError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Workspace Area */}
          <main className="min-h-screen pb-24 md:pb-10 md:pl-[72px] lg:pl-[232px]">
            <div className="mx-auto w-full max-w-[1380px] px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pt-8">
              <div className="rounded-[12px] border border-[#E9E8E1]/80 bg-white p-4 shadow-[0_1px_4px_rgba(27,28,24,0.03)] sm:p-6 lg:p-8">
                {children}
              </div>
            </div>
          </main>

          {/* Mobile Bottom Navigation + Full Navigation Drawer */}
          <nav
            aria-label="Mobile navigation"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E9E8E1] bg-white/95 px-1.5 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur md:hidden"
          >
            {NAV_ITEMS.slice(0, 4).map((item) => (
              <NavEntry
                key={item.href}
                item={item}
                active={isRouteActive(item.href)}
                variant="mobile"
                onSetupAction={openSetupAction}
              />
            ))}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-expanded={mobileDrawerOpen}
              aria-label="More workspace navigation"
              className="flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] px-1 py-1.5 text-center font-['Space_Grotesk'] text-[10px] font-medium text-[#444748] transition-colors hover:bg-[#ECEBE4]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span className="max-w-full truncate">More</span>
            </button>
          </nav>

          {mobileDrawerOpen ? (
            <div
              className="fixed inset-0 z-50 flex justify-end bg-[#1B1C18]/30 backdrop-blur-[1px] md:hidden"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setMobileDrawerOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Workspace navigation"
                className="flex h-full w-76 max-w-[85vw] flex-col justify-between overflow-y-auto border-l border-[#E9E8E1] bg-[#F5F4ED] p-4 shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#E6E5DD] pb-3">
                    <span className="flex h-8 items-center gap-2.5 whitespace-nowrap">
                      <Image
                        src="/Foolioo.svg"
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 shrink-0"
                      />
                      <span className="font-['Newsreader'] text-[23px] font-semibold italic leading-none tracking-[-0.6px] text-[#1B1C18]">
                        Foolioo
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileDrawerOpen(false)}
                      aria-label="Close navigation"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[#444748] hover:bg-[#ECEBE4]"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => {
                      const active = isRouteActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileDrawerOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2.5 font-['Space_Grotesk'] text-[14px] transition-colors ${
                            active
                              ? "border border-[#E6E4DC] bg-white font-semibold text-[#644ABB]"
                              : "text-[#444748] hover:bg-[#ECEBE4]"
                          }`}
                        >
                          <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#E6E5DD] pt-3">
                  {profile.isTrial ? (
                    <div className="rounded-[10px] border border-[#E6E4DC] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] ${profile.trialExpired ? "text-[#A33A32]" : "text-[#8E918B]"}`}>
                          {profile.trialExpired ? "Trial Expired" : "Trial Status"}
                        </span>
                        {trialDays !== null ? (
                          <span className={`rounded-full px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold ${profile.trialExpired ? "bg-[#FBE8E6] text-[#A33A32]" : trialDays <= 3 ? "bg-[#FFFAEC] text-[#8A6826]" : "bg-[#EFEAFB] text-[#644ABB]"}`}>
                            {profile.trialExpired ? "Expired" : `${trialDays}d left`}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18]">
                        {upgradeCardHeadline}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileDrawerOpen(false);
                          setSettingsSection("plan");
                          setSettingsOpen(true);
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB]"
                      >
                        <span>{upgradeCardAction}</span>
                        <span aria-hidden="true">›</span>
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setSearchOpen(true);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-[8px] px-3 py-2 font-['Space_Grotesk'] text-[13px] text-[#444748] hover:bg-[#ECEBE4]"
                  >
                    <Icon name="search" className="h-4 w-4" />
                    <span>Search</span>
                  </button>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-[8px] px-3 py-2 font-['Space_Grotesk'] text-[13px] text-[#444748] hover:bg-[#ECEBE4]"
                  >
                    <Icon name="settings" className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-[8px] bg-[#ECEBE4] px-3 py-2.5"
                  >
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 shrink-0 rounded-[6px] object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#1B1C18] font-['Space_Grotesk'] text-[11px] font-semibold text-white">
                        {initials(profile.displayName)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                        {profile.displayName}
                      </span>
                      <span className="block truncate font-['Space_Grotesk'] text-[11px] text-[#666A68]">
                        {profile.email}
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

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
                      ) : item.setupAction ? (
                        <button type="button" onClick={() => openSetupAction(item.setupAction!)} className="font-['Space_Grotesk'] text-[11px] font-medium text-[#644ABB]">Open setup</button>
                      ) : (
                        <span className="font-['Space_Grotesk'] text-[10px] text-[#929493]">Not available yet</span>
                      )}
                    </div>
                  ))}
                  {filteredItems.length === 0 ? <p className="px-3 py-5 text-center font-['Space_Grotesk'] text-[12px] text-[#747878]">No matching sections.</p> : null}
                </div>
                <div className="border-t border-[#E9E8E1] px-4 py-2 font-['Space_Grotesk'] text-[10px] text-[#929493]">Navigate to sections available in this workspace</div>
              </div>
            </div>
          ) : null}

          {settingsOpen ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1B1C18]/30 px-4 py-8"
              onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}
            >
              <section role="dialog" aria-modal="true" aria-labelledby="workspace-settings-title" className="w-full max-w-[480px] rounded-[10px] border border-[#E9E8E1] bg-white p-5 shadow-[0_20px_64px_rgba(27,28,24,0.2)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.09em] text-[#747878]">ACCOUNT</p>
                    <h2 id="workspace-settings-title" className="mt-1 font-['Newsreader'] text-[26px] text-[#1B1C18]">{settingsSection === "plan" ? "Upgrade your workspace" : "Workspace settings"}</h2>
                    <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#747878]">{profile.workspaceName}</p>
                  </div>
                  <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="rounded-[4px] p-2 text-[#747878] hover:bg-[#F5F4ED]">×</button>
                </div>

                <div className="mt-5 rounded-[7px] border border-[#E9E8E1] bg-[#FBFAF6] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.07em] text-[#747878]">WORKSPACE ID</p>
                      <p className="mt-1 truncate font-mono text-[12px] text-[#1B1C18]" title={profile.workspaceId ?? undefined}>{profile.workspaceId ?? "Unavailable"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={copyWorkspaceId}
                      disabled={!profile.workspaceId}
                      className="shrink-0 rounded-[4px] border border-[#D8D8D1] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5F4ED] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copiedWorkspaceId ? "Copied" : "Copy ID"}
                    </button>
                  </div>
                  {copyError ? <p className="mt-2 font-['Space_Grotesk'] text-[10px] text-[#A33A32]">{copyError}</p> : null}
                </div>

                <div className="mt-3 rounded-[7px] border border-[#E9E8E1] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.07em] text-[#747878]">CURRENT PLAN</p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">{profile.planName ?? (profile.isTrial ? "Trial" : "Workspace plan")}</p>
                    </div>
                    {profile.trialDaysLeft !== null ? <span className="rounded-[4px] bg-[#E7DEFF] px-2.5 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#4C30A2]">{profile.trialDaysLeft} days left</span> : null}
                  </div>
                  <p className="mt-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">To upgrade your plan or change your subscription, contact us at{" "}<a href="mailto:support@foolioo.app" className="font-semibold text-[#4C30A2] underline underline-offset-2 hover:text-[#3A2280]">support@foolioo.app</a> and we&apos;ll get back to you within one business day.</p>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-[4px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]">Done</button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </DashboardNavigationContext.Provider>
    </DashboardProfileContext.Provider>
  );
}