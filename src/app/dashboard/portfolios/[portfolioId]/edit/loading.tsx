
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function EditPortfolioLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-7 w-2/3"/></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter><Skeleton className="h-10 w-full"/></CardFooter>
          </Card>
           <Card>
            <CardHeader><Skeleton className="h-6 w-1/2"/></CardHeader>
          </Card>
        </div>
        <div className="lg:col-span-9">
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/4"/>
              <Skeleton className="h-4 w-1/2"/>
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-video w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
