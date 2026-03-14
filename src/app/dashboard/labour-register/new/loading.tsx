
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function NewLabourRegisterLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-1" />
            <Skeleton className="h-4 w-1/2" />
            </CardHeader>
          <CardContent className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <div className="grid md:grid-cols-2 gap-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter>
              <Skeleton className="h-10 w-32" />
          </CardFooter>
      </Card>
    </div>
  );
}
