import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-xl border bg-card p-5 transition-colors",
        href && "hover:border-ring",
        highlight && "border-[#ead7b3] bg-warning-soft/50",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}
