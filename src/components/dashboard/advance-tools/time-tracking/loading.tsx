
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function TimeTrackingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-1/3" />
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-10 w-full md:w-1/2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-10 w-28" />
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg">
            <div className="h-[400px] w-full p-4">
             <Skeleton className="h-full w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
