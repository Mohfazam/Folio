"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const navLinks = [
    { label: "Products", href: "#products" },
    { label: "Customers", href: "#customers" },
    { label: "Resources", href: "#resources" },
    { label: "Pricing", href: "#pricing" },
  ];

  const navItem =
    "whitespace-nowrap font-['Space_Grotesk'] text-[13px] font-medium leading-[18px] tracking-[0.1px] text-[#55534F] transition-colors duration-200 hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] focus-visible:ring-offset-4";

  const primaryButton =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1px] text-white shadow-[0_3px_10px_rgba(27,28,24,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#34352F] hover:shadow-[0_5px_16px_rgba(27,28,24,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] focus-visible:ring-offset-2";
  const handleNavClick = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (mounted) {
        if (error) {
          console.error("Failed to fetch user:", error);
        }

        setUser(user);
        setIsLoading(false);
      }
    };

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <nav className="relative z-50 w-full border-b border-[#EAE6DC] bg-[#FBF9F2]/90 shadow-[0_2px_12px_rgba(34,30,20,0.035)] backdrop-blur-xl">
      {/* Main Navbar */}
      <div className="mx-auto flex h-[76px] w-full items-center justify-between px-5 sm:px-7 md:px-10 lg:px-8 xl:px-24">
        {/* Brand and Desktop Navigation */}
        <div className="flex min-w-0 items-center gap-7 xl:gap-11">
          <Link
            href="/"
            onClick={handleNavClick}
            aria-label="Foolioo home"
            className="group inline-flex shrink-0 items-center gap-[9px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] focus-visible:ring-offset-4"
          >
            <Image
              src="/Foolioo.svg"
              alt=""
              aria-hidden="true"
              width={29}
              height={34}
              priority
              className="h-[34px] w-[29px] object-contain transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]"
            />

            <span className="relative -mt-0.5 inline-flex items-baseline font-['Newsreader'] text-[31px] font-medium italic leading-none tracking-[-1.55px] text-[#24231F] transition-colors duration-200 group-hover:text-[#FD7032]">
              foolioo
              <span className="ml-[1px] not-italic text-[#FD7032]">.</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-5 lg:flex xl:gap-7">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={navItem}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-5 lg:flex xl:gap-7">
          {!isLoading && !user && (
            <Link href="/sign-in" className={navItem}>
              Log in
            </Link>
          )}

          <a
            href="mailto:sales@foolioo.app?subject=Sales%20Inquiry"
            className={navItem}
          >
            Contact Sales
          </a>

          <a href="#demo" className={navItem}>
            View Demo
          </a>

          {!isLoading && (
            user ? (
              <Link href="/dashboard" className={primaryButton}>
                Dashboard
              </Link>
            ) : (
              <Link href="/sign-up" className={primaryButton}>
                Start free trial
                <span aria-hidden="true" className="ml-2 text-[15px] leading-none">
                  ↗
                </span>
              </Link>
            )
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#24231F] transition-colors hover:bg-[#F0EDE5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] lg:hidden"
        >
          {menuOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          id="mobile-navigation"
          className="absolute left-0 top-full w-full border-t border-[#EAE6DC] bg-[#FBF9F2]/[0.98] px-6 py-6 shadow-[0_16px_35px_rgba(34,30,20,0.09)] backdrop-blur-xl md:px-10 lg:hidden"
        >
          <div className="flex flex-col gap-5">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={handleNavClick}
                className={`${navItem} w-full text-[14px]`}
              >
                {item.label}
              </a>
            ))}

            <div className="my-1 border-t border-[#EAE6DC]" />

            {!isLoading && !user && (
              <Link
                href="/sign-in"
                onClick={handleNavClick}
                className={`${navItem} text-left text-[14px]`}
              >
                Log in
              </Link>
            )}

            <a
              href="mailto:sales@foolioo.app?subject=Sales%20Inquiry"
              onClick={handleNavClick}
              className={`${navItem} text-left text-[14px]`}
            >
              Contact Sales
            </a>

            <a
              href="#demo"
              onClick={handleNavClick}
              className={`${navItem} text-left text-[14px]`}
            >
              View Demo
            </a>

            {!isLoading && (
              user ? (
                <Link
                  href="/dashboard"
                  onClick={handleNavClick}
                  className={`${primaryButton} w-full`}
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  onClick={handleNavClick}
                  className={`${primaryButton} w-full`}
                >
                  Start free trial
                  <span aria-hidden="true" className="ml-2 text-[15px] leading-none">
                    ↗
                  </span>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
