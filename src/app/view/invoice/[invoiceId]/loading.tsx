
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicInvoiceViewLoading() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg">
        <header className="p-4 border-b">
          <Skeleton className="h-6 w-1/3" />
        </header>
        <div className="p-6 space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-10 w-1/4" />
          </div>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <div className="flex justify-end">
            <Skeleton className="h-24 w-1/3" />
          </div>
        </div>
        <footer className="p-4 border-t text-center">
          <Skeleton className="h-4 w-1/4 mx-auto" />
        </footer>
      </div>
    </div>
  );
}
