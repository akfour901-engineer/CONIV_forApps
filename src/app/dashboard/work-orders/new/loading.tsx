
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function NewWorkOrderLoading() {
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
        <CardContent className="grid md:grid-cols-2 gap-6">
          {[...Array(8)].map((_, i) => ( // Increased to 8 for more fields
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
        <CardContent> <Skeleton className="h-24 w-full" /> </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
           <Skeleton className="h-32 w-full" />
           <Skeleton className="h-32 w-full" />
        </CardContent>
        <CardFooter><Skeleton className="h-10 w-36" /></CardFooter>
      </Card>
    </div>
  );
}
