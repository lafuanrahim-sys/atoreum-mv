"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/preorders", label: "Pre-Orders" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/boli", label: "Boli" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/profile", label: "My Profile" },
  { href: "/dashboard/settings", label: "Settings" },
];

// The numbered index replaces icons entirely — a table-of-contents in the
// sidebar reads as considered/bespoke where an icon set reads as templated,
// and at nine short, clearly-labeled items nothing is lost for scanability.
export default function DashboardNav({
  unreadMessages = 0,
  onNavigate,
}: {
  unreadMessages?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col">
      {NAV_ITEMS.map((item, index) => {
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
              "group flex items-center gap-3 border-l-2 py-2.5 pl-4 pr-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
              isActive ? "border-gold-deep text-ivory" : "border-transparent text-ivory-dim hover:border-line hover:text-ivory"
            )}
          >
            <span className={cn("text-[10px] tabular-nums", isActive ? "text-gold-deep" : "text-ivory-dim/50")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={cn("flex-1", isActive && "italic")}>{item.label}</span>
            {badge !== null && (
              <span className={cn("shrink-0 font-mono text-[10px] tabular-nums", isActive ? "text-ivory" : "text-gold-deep")}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
