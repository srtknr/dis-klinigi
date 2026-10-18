import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6" role="status" aria-label="Yükleniyor">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
