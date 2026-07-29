"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MARKET_TABS, type MarketTabId } from "@lankapulse/shared";
import { authClient } from "@/lib/auth-client";
import { canAccessAdmin, canAccessOps, getStaffRole } from "@/lib/roles";

function Icon({
  id,
  size = 18,
}: {
  id: MarketTabId | "home" | "ops" | "admin" | "pro" | "news";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "news":
      return (
        <svg {...common}>
          <path d="M4 5h12a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z" />
          <path d="M18 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" />
          <path d="M8 9h6M8 13h6M8 17h3" />
        </svg>
      );
    case "mm":
      return (
        <svg {...common}>
          <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M12 14v2" />
        </svg>
      );
    case "fx":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case "fi":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V8" />
          <path d="M16 15v-6" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <path d="M4 16l5-5 3 3 7-8" />
          <path d="M14 6h5v5" />
        </svg>
      );
    case "ei":
      return (
        <svg {...common}>
          <path d="M5 19V9" />
          <path d="M10 19V5" />
          <path d="M15 19v-7" />
          <path d="M20 19V11" />
        </svg>
      );
    case "esp":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
          <path d="M7.5 9.5c1.5-2 3-3 4.5-3s3 1 4.5 3" />
          <path d="M7.5 14.5c1.5 2 3 3 4.5 3s3-1 4.5-3" />
        </svg>
      );
    case "ops":
      return (
        <svg {...common}>
          <path d="M9 5h11M9 12h11M9 19h11" />
          <path d="M4 5h.01M4 12h.01M4 19h.01" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "pro":
      return (
        <svg {...common}>
          <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3Z" />
        </svg>
      );
    default:
      return null;
  }
}

function NavLink({
  href,
  label,
  icon,
  active,
  hint,
  muted,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  hint?: string;
  muted?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      className={`side-link${active ? " active" : ""}${muted ? " is-muted" : ""}`}
      aria-current={active ? "page" : undefined}
      title={muted ? `${label} · soon` : undefined}
      onClick={onNavigate}
    >
      <span className="side-link-icon">{icon}</span>
      <span className="side-link-text">
        <span className="side-link-label">{label}</span>
        {hint ? <span className="side-link-hint">{hint}</span> : null}
      </span>
    </Link>
  );
}

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const role = getStaffRole(session);
  const showOps = canAccessOps(role);
  const showAdmin = canAccessAdmin(role);

  return (
    <>
      <div
        className={open ? "sidebar-backdrop open" : "sidebar-backdrop"}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={open ? "sidebar open" : "sidebar"} aria-label="Primary">
        <div className="sidebar-brand">
          <Link href="/" className="brand" onClick={onClose}>
            Market<span>Pulse</span>
          </Link>
          <p className="sidebar-tagline">CBSL-verified morning brief</p>
        </div>

        <nav className="sidebar-nav" onClick={onClose}>
          <div className="side-section">
            <div className="side-section-label">Overview</div>
            <NavLink
              href="/"
              label="Home"
              icon={<Icon id="home" />}
              active={pathname === "/"}
            />
            <NavLink
              href="/news"
              label="Market news"
              hint="Desk"
              icon={<Icon id="news" />}
              active={pathname.startsWith("/news")}
            />
          </div>

          <div className="side-section">
            <div className="side-section-label">Markets</div>
            {MARKET_TABS.map((tab) => {
              const href = `/markets/${tab.path}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const guideHint =
                tab.id === "mm"
                  ? "Start here"
                  : tab.id === "fx"
                    ? "Rupee"
                    : tab.id === "fi"
                      ? "Bills"
                      : tab.id === "share"
                        ? "Equities"
                        : tab.id === "ei"
                          ? "Macro"
                          : "External";
              return (
                <NavLink
                  key={tab.id}
                  href={href}
                  label={tab.title}
                  hint={tab.live ? guideHint : "Soon"}
                  icon={<Icon id={tab.id} />}
                  active={active}
                  muted={!tab.live}
                />
              );
            })}
          </div>

          <div className="side-section">
            <div className="side-section-label">Workspace</div>
            {showOps ? (
              <NavLink
                href="/ops"
                label="Ops review"
                icon={<Icon id="ops" />}
                active={pathname.startsWith("/ops")}
              />
            ) : null}
            {showAdmin ? (
              <NavLink
                href="/admin"
                label="Admin"
                icon={<Icon id="admin" />}
                active={pathname.startsWith("/admin")}
              />
            ) : null}
            <NavLink
              href="/pricing"
              label="Pro"
              icon={<Icon id="pro" />}
              active={pathname.startsWith("/pricing")}
            />
          </div>
        </nav>

        <div className="sidebar-foot">
          <span className="sidebar-foot-meta">Start with Money Market</span>
        </div>
      </aside>
    </>
  );
}
