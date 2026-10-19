"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/public/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationBell } from "@/components/admin/notification-bell";
import type { StaffNotificationDto } from "@/features/notifications/service";
import { logoutAction } from "@/features/auth/actions";
import { ROLE_LABELS, type PermissionKey, type RoleKey } from "@/lib/permissions";

type ShellProps = {
  clinicName: string;
  userName: string;
  role: RoleKey;
  permissions: PermissionKey[];
  pendingCount: number;
  isDemo: boolean;
  notifications: { items: StaffNotificationDto[]; unread: number };
  children: React.ReactNode;
};

export function AdminShell({ clinicName, userName, role, permissions, pendingCount, isDemo, notifications, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const nav = (onNavigate?: () => void) => (
    <AdminNav role={role} permissions={permissions} pendingCount={pendingCount} onNavigate={onNavigate} />
  );

  return (
    <div className="flex min-h-svh flex-1">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <BrandMark className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{clinicName}</p>
            <p className="text-xs text-muted-foreground">Yönetim paneli</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">{nav()}</div>
        <UserBox userName={userName} role={role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menüyü aç">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>{clinicName}</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 py-4">{nav(() => setOpen(false))}</div>
                <UserBox userName={userName} role={role} />
              </SheetContent>
            </Sheet>
            <span className="truncate text-sm font-medium">{clinicName}</span>
          </div>
          <div className="hidden lg:block">
            {isDemo ? (
              <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
                Demo veriler · gerçek hasta bilgisi değildir
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell items={notifications.items} unread={notifications.unread} />
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                Web sitesi <ExternalLink aria-hidden />
              </Link>
            </Button>
          </div>
        </header>
        <main id="icerik" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function UserBox({ userName, role }: { userName: string; role: RoleKey }) {
  return (
    <div className="border-t p-4">
      <p className="truncate text-sm font-medium">{userName}</p>
      <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
      <form action={logoutAction} className="mt-3">
        <Button type="submit" variant="outline" size="sm" className="w-full">
          <LogOut aria-hidden /> Çıkış yap
        </Button>
      </form>
    </div>
  );
}
