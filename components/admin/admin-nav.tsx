"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  PlugZap,
  ScrollText,
  Settings,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import type { PermissionKey, RoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  exact?: boolean;
  badge?: "pending";
};

const SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
      { href: "/admin/randevular", label: "Randevular", icon: ClipboardList, permission: "APPOINTMENT_VIEW", badge: "pending", exact: true },
      { href: "/admin/randevular/takvim", label: "Takvim", icon: CalendarDays, permission: "APPOINTMENT_VIEW" },
      { href: "/admin/hastalar", label: "Hastalar", icon: Users, permission: "PATIENT_VIEW" },
      { href: "/admin/doktorlar", label: "Doktorlar", icon: Stethoscope, permission: "DENTIST_VIEW" },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { href: "/admin/personel", label: "Personel ve Yetkiler", icon: UserCog, permission: "STAFF_MANAGE" },
      { href: "/admin/ayarlar", label: "Klinik Ayarları", icon: Settings, permission: "SETTINGS_MANAGE" },
      { href: "/admin/entegrasyonlar", label: "Entegrasyonlar", icon: PlugZap, permission: "SETTINGS_MANAGE" },
      { href: "/admin/bildirimler", label: "Bildirim Kayıtları", icon: Bell, permission: "SETTINGS_MANAGE" },
      { href: "/admin/denetim", label: "Denetim Kayıtları", icon: ScrollText, permission: "AUDIT_VIEW" },
    ],
  },
];

export function AdminNav({
  role,
  permissions,
  pendingCount,
  onNavigate,
}: {
  role: RoleKey;
  permissions: PermissionKey[];
  pendingCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const allowed = (p?: PermissionKey) => !p || role === "OWNER" || permissions.includes(p);
  const isActive = (item: NavItem) => {
    if (item.exact) {
      if (item.href === "/admin/randevular") {
        return pathname === item.href || (pathname.startsWith("/admin/randevular/") && !pathname.startsWith("/admin/randevular/takvim"));
      }
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <nav aria-label="Yönetim menüsü" className="space-y-6">
      {SECTIONS.map((section, i) => {
        const items = section.items.filter((it) => allowed(it.permission));
        if (items.length === 0) return null;
        return (
          <div key={i}>
            {section.title ? (
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.title}</p>
            ) : null}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {item.badge === "pending" && pendingCount > 0 ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">
                          {pendingCount}
                          <span className="sr-only"> onay bekleyen talep</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
