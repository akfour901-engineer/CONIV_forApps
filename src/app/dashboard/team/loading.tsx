
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function TeamLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-60 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      
      {/* Skeleton for Active Members */}
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-2" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Skeleton className="h-10 w-full md:w-1/3" />
            <Skeleton className="h-10 w-full md:w-[180px]" />
          </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
                <Card key={i} className="p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                    </div>
                </div>
                </Card>
            ))}
            </div>
        </CardContent>
         <CardFooter>
            <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
      
      {/* Skeleton for Pending Invitations */}
       <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-2" />
          <Skeleton className="h-4 w-3/4" />
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Skeleton className="h-10 w-full md:w-1/3" />
            <Skeleton className="h-10 w-full md:w-[180px]" />
          </div>
        </CardHeader>
        <CardContent>
             <div className="space-y-4">
            {[...Array(1)].map((_, i) => (
                <Card key={i} className="p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </div>
                </Card>
            ))}
            </div>
        </CardContent>
        <CardFooter>
            <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}
