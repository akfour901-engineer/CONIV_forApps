
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function PublicPortfolioLoading() {
  return (
    <div className="space-y-8 p-4">
      <header className="flex justify-between items-center h-16">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-24" />
        </div>
      </header>

      <section className="text-center py-20 bg-muted">
        <Skeleton className="h-12 w-3/4 mx-auto mb-4" />
        <Skeleton className="h-6 w-1/2 mx-auto mb-8" />
        <Skeleton className="h-12 w-48 mx-auto" />
      </section>

      <section className="py-16">
        <div className="container mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div>
                 <Skeleton className="h-8 w-1/3 mb-4" />
                 <Skeleton className="h-6 w-full mb-2" />
                 <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="aspect-video w-full rounded-lg" />
        </div>
      </section>

      <section className="py-16 bg-muted">
        <div className="container mx-auto text-center">
          <Skeleton className="h-8 w-1/2 mx-auto mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </section>

       <footer className="py-8 bg-background border-t">
        <div className="container mx-auto flex justify-between items-center">
            <Skeleton className="h-4 w-1/4" />
            <div className="flex gap-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
            </div>
        </div>
       </footer>

    </div>
  );
}
