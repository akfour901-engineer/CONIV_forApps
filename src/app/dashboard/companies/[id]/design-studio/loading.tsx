
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function AiDesignStudioLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-2" />
        </CardHeader>
        <CardContent className="space-y-4">
           <Skeleton className="h-24 w-full" />
           <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-40" />
        </CardFooter>
      </Card>
       <Card>
        <CardHeader>
          <Skeleton className="h-7 w-1/2 mb-2" />
        </CardHeader>
        <CardContent className="h-[300px]">
            <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
