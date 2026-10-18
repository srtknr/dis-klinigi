import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/text";

export function PersonAvatar({
  name,
  initialsOf,
  photoUrl,
  size = 48,
  className,
}: {
  name: string;
  /** Baş harfler için ad (unvan hariç); verilmezse `name` kullanılır */
  initialsOf?: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        unoptimized={photoUrl.startsWith("/media/")}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-sand font-medium text-primary",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.34) }}
    >
      {initials(initialsOf ?? name)}
    </div>
  );
}
