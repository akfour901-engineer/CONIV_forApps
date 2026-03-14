
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function AiQAndAAuditorLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader>
          <Skeleton className="h-7 w-1/2" />
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-hidden">
           <Skeleton className="h-10 w-3/4" />
           <Skeleton className="h-10 w-1/2 ml-auto" />
           <Skeleton className="h-12 w-3/4" />
        </CardContent>
        <CardFooter className="border-t p-4">
             <div className="flex w-full items-center space-x-2">
                <Skeleton className="h-10 flex-grow" />
                <Skeleton className="h-10 w-10" />
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
