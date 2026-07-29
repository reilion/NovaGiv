import { Skeleton } from "@/components/ui/skeleton";

export function FilterBarSkeleton() {
  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <Skeleton className="h-8 w-80 max-w-full rounded-lg" />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg sm:w-44" />
        <Skeleton className="h-8 w-full rounded-lg sm:w-48" />
      </div>
    </div>
  );
}
