"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
    icon: (
      <path d="M3.75 10.5 12 4l8.25 6.5V20a1 1 0 0 1-1 1h-5v-6h-4.5v6h-5a1 1 0 0 1-1-1v-9.5Z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: (
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9ZM12 12 3.8 7.7M12 12l8.2-4.3M12 12v8.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: (
      <path d="M6 7h12l1 13H5L6 7Zm3 3V6a3 3 0 0 1 6 0v4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/preorders",
    label: "Pre-Orders",
    icon: (
      <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: (
      <path d="M15.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM4.5 20c.9-3.2 4-5 7.5-5s6.6 1.8 7.5 5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/reviews",
    label: "Reviews",
    icon: (
      <path d="M12 3.5l2.47 5.3 5.8.7-4.28 3.98 1.13 5.72L12 16.35 6.88 19.2l1.13-5.72L3.73 9.5l5.8-.7L12 3.5Z" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: (
      <path d="M4 6h16v12H4V6Zm0 .5 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/profile",
    label: "My Profile",
    icon: (
      <path d="M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c1.1-3 3.9-4.5 7-4.5s5.9 1.5 7 4.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export default function DashboardNav({
  unreadMessages = 0,
  onNavigate,
}: {
  unreadMessages?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const badge = item.href === "/dashboard/messages" && unreadMessages > 0 ? unreadMessages : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-2.5 text-xs uppercase tracking-[0.12em] transition-colors",
              isActive
                ? "bg-gold text-ink"
                : "text-ivory-dim hover:bg-ink-2 hover:text-gold"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 shrink-0">
              {item.icon}
            </svg>
            {item.label}
            {badge !== null && (
              <span
                className={cn(
                  "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums",
                  isActive ? "bg-ink text-ivory" : "bg-gold text-ink"
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
