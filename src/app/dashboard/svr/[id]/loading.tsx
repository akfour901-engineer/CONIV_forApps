

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function ViewSvrLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
             <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
           <div className="grid grid-cols-5 gap-2">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-md"/>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
    
