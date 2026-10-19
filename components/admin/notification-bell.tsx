"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bell, CheckCheck, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsReadAction } from "@/features/notifications/actions";
import type { StaffNotificationDto } from "@/features/notifications/service";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export function NotificationBell({ items, unread }: { items: StaffNotificationDto[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Yeni bildirimleri görmek için sayfa verisini periyodik yenile (sekme görünürken)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  const markRead = (ids?: string[]) =>
    startTransition(async () => {
      await markNotificationsReadAction(ids);
      router.refresh();
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}>
          <Bell aria-hidden />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Bildirimler</h2>
          {unread > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => markRead()}>
              <CheckCheck aria-hidden /> Tümünü okundu yap
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => {
              const content = (
                <div className="flex gap-3">
                  {n.kind === "ATTENDANCE_NO" ? (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-danger-foreground" aria-hidden />
                  ) : (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#3f5238]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read ? <span className="mt-1.5 ml-auto size-2 shrink-0 rounded-full bg-primary" aria-label="Okunmadı" /> : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block px-4 py-3 hover:bg-muted/60"
                      onClick={() => {
                        setOpen(false);
                        if (!n.read) markRead([n.id]);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
