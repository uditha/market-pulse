"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { authClient } from "@/lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="app-frame">
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <button
              type="button"
              className="topbar-search-hint"
              title="Press ⌘K"
              onClick={() => window.dispatchEvent(new Event("marketpulse:open-search"))}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>Search series</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
          </div>
          <nav className="nav">
            <ThemeToggle />
            {isPending ? null : session?.user ? (
              <UserMenu
                name={session.user.name}
                email={session.user.email}
                image={session.user.image}
              />
            ) : (
              <Link className="btn btn-primary" href="/login">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        <div className={`app-content${pathname === "/" ? " is-home" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
