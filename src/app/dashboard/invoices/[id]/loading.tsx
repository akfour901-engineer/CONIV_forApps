
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function ViewInvoicePageLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex justify-between items-start">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          <Skeleton className="h-4 w-1/3 mt-2 mb-1" />
          <Skeleton className="h-24 w-full" /> {/* Items table placeholder */}
           <Skeleton className="h-4 w-1/3 mt-2 mb-1" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" /> {/* Totals section */}
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-4 w-1/2" /> {/* Last updated */}
        </CardFooter>
      </Card>
    </div>
  );
}

    