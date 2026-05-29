"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, FolderOpen, Settings, UploadCloud } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/cases", label: "Cases", icon: FolderOpen },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/reports/run-structural-demo", label: "Reports", icon: FileText },
  { href: "#settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 border-r border-line bg-ink/85 p-5 lg:block">
      <Link href="/" className="block">
        <div className="text-xl font-semibold tracking-[0.18em] text-white">COHERENCE</div>
        <div className="mt-1 text-xs uppercase text-cyan-100/60">Clinician support</div>
      </Link>
      <nav className="mt-10 space-y-2" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                active ? "bg-cyan-400/12 text-cyan-50" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
