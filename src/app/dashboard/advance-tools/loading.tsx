
import { Skeleton } from "@/components/ui/skeleton";

// A simple loading skeleton for this page
export default function AdvanceToolsLoadingSkeleton() {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-72 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-7 w-1/3" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
}
