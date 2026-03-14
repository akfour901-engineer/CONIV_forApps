
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function CompanyDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-1/2 mb-4" />
          <Skeleton className="h-10 w-1/4" />
      </div>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start gap-4">
          <Skeleton className="h-[100px] w-[100px] rounded-md border" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-28" />
        </CardFooter>
      </Card>
    </div>
  );
}
