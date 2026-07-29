import { Skeleton } from "@/components/ui/skeleton";

export function MediaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-3 w-2/5 rounded" />
        </div>
      ))}
    </div>
  );
}
