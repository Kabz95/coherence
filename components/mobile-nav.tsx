"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Brain, FileText, LayoutDashboard, Upload } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: Brain },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reports/demo", label: "Reports", icon: FileText },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/reports/demo") return pathname.startsWith("/reports");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom navigation bar for small screens, where the desktop sidebar is
 * hidden. Always visible; active route is highlighted.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-midnight/90 backdrop-blur-xl lg:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] transition-colors ${
                active ? "text-copper-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-white/5 py-1.5 text-[10px] text-slate-500">
        <Activity className="h-3 w-3" aria-hidden />
        Coherence — supplementary, non-diagnostic
      </div>
    </nav>
  );
}
