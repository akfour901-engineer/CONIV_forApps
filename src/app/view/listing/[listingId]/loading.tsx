
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function PublicListingViewLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="shadow-xl max-w-lg w-full">
        <CardHeader className="p-6">
          <div className="flex justify-between items-start gap-2 mb-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="aspect-video w-full rounded-md" />
          </div>
          <Skeleton className="h-px w-full my-3" /> {/* Separator */}
          <Skeleton className="h-5 w-1/4 mb-1" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-px w-full my-3" /> {/* Separator */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-6 w-1/3 mb-1" />
              <Skeleton className="h-10 w-full" /> 
            </div>
            <div>
              <Skeleton className="h-6 w-1/3 mb-1" />
              <Skeleton className="h-16 w-full" /> 
            </div>
          </div>
           <Skeleton className="h-px w-full my-3" /> {/* Separator */}
           <Skeleton className="h-6 w-1/3 mb-2" />
           <Skeleton className="h-4 w-full" />
           <Skeleton className="h-4 w-full" />
           <Skeleton className="h-4 w-2/3" />
        </CardContent>
        <CardFooter className="p-4 border-t text-center bg-gray-50">
          <Skeleton className="h-4 w-1/3 mx-auto" />
        </CardFooter>
      </Card>
    </div>
  );
}
    