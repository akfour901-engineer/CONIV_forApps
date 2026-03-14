
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function PublicDigitalBusinessCardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="shadow-xl max-w-sm w-full">
        <CardHeader className="p-6 text-center space-y-3">
          <Skeleton className="h-20 w-20 rounded-md mx-auto" /> {/* Logo placeholder */}
          <Skeleton className="h-24 w-24 rounded-full mx-auto" /> {/* Profile Pic placeholder */}
          <Skeleton className="h-7 w-3/4 mx-auto mt-1" /> {/* Name placeholder */}
          <Skeleton className="h-4 w-1/2 mx-auto" /> {/* Title placeholder */}
          <Skeleton className="h-5 w-2/3 mx-auto" /> {/* Company placeholder */}
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
           <Skeleton className="h-px w-full my-4" /> {/* Separator placeholder */}
           {[...Array(2)].map((_, i) => (
            <div key={`social-${i}`} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </CardContent>
        <CardFooter className="p-4 border-t text-center flex-col items-center space-y-2">
          <Skeleton className="h-32 w-32 rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
        </CardFooter>
      </Card>
    </div>
  );
}
    