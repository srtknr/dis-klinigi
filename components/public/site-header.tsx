"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/public/brand";

const NAV = [
  { href: "/", label: "Anasayfa" },
  { href: "/doktorlar", label: "Doktorlarımız" },
  { href: "/hizmetler", label: "Hizmetlerimiz" },
  { href: "/iletisim", label: "İletişim" },
];

export function SiteHeader({ clinicName }: { clinicName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${clinicName} anasayfa`}>
          <BrandMark />
          <span className="font-display text-lg font-medium">{clinicName}</span>
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground font-medium",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/randevu">
              <CalendarPlus aria-hidden /> Randevu Oluştur
            </Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menüyü aç">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <SheetHeader>
                <SheetTitle className="font-display">{clinicName}</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobil menü" className="flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-3 text-base hover:bg-muted",
                      isActive(item.href) && "bg-muted font-medium",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <Button asChild className="mt-4" onClick={() => setOpen(false)}>
                  <Link href="/randevu">
                    <CalendarPlus aria-hidden /> Randevu Oluştur
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
