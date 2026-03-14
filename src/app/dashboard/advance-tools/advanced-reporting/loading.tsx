
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function AdvancedReportingLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

       <Card className="shadow-lg">
        <CardHeader><Skeleton className="h-7 w-1/2 mb-1" /></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
            <Skeleton className="h-7 w-1/2 mb-1" />
            <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="h-[400px]">
            <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
              <Skeleton className="h-7 w-1/2 mb-1" />
              <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="h-[450px] flex items-center justify-center">
              <div className="relative w-60 h-60">
                  <Skeleton className="h-full w-full rounded-full" />
                  <Skeleton className="absolute inset-[25%] h-1/2 w-1/2 rounded-full bg-background" />
              </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
              <Skeleton className="h-7 w-1/2 mb-1" />
              <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="h-[450px]">
            <Skeleton className="h-full w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="shadow-lg">
            <CardHeader>
              <Skeleton className="h-7 w-1/2 mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="h-[350px]">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-1" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="h-[400px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>

      <Skeleton className="h-10 w-40" />
    </div>
  );
}
    