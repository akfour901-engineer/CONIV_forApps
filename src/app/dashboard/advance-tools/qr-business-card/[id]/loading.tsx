
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function ViewDigitalBusinessCardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="shadow-lg max-w-sm mx-auto">
        <CardHeader className="p-6 text-center space-y-3">
          <Skeleton className="h-24 w-24 rounded-full mx-auto" />
          <Skeleton className="h-7 w-3/4 mx-auto mt-1" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-5 w-2/3 mx-auto" />
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </CardContent>
        <CardFooter className="p-4 border-t text-center flex-col items-center space-y-2">
          <Skeleton className="h-32 w-32 rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
        </CardFooter>
      </Card>
      <Card className="shadow-lg max-w-sm mx-auto">
        <CardHeader><Skeleton className="h-7 w-1/3" /></CardHeader>
        <CardContent><Skeleton className="h-10 w-full" /></CardContent>
      </Card>
    </div>
  );
}
    