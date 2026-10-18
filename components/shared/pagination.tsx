import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return <p className="mt-4 text-sm text-muted-foreground">Toplam {total} kayıt</p>;
  }
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Sayfalama" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Toplam {total} kayıt · Sayfa {page} / {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>
              <ChevronLeft aria-hidden /> Önceki
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden /> Önceki
          </Button>
        )}
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>
              Sonraki <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Sonraki <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}
