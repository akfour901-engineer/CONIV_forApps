
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function ViewPurchaseOrderLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="shadow-lg">
        <CardHeader><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_,i) => <Skeleton key={i} className="h-6 w-full" />)}
          <Skeleton className="h-24 w-full mt-4" />
        </CardContent>
        <CardFooter className="flex justify-between">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
    </div>
  );
}
    