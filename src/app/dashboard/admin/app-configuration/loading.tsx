
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function AppConfigurationLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64 mb-2" />
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-7 w-1/3" /></CardHeader>
          <CardContent className="space-y-3">
             {[...Array(3)].map((_, j) => (
                <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <CardFooter className="flex justify-end sticky bottom-0 bg-background/95 py-4 border-t">
        <Skeleton className="h-10 w-36" />
      </CardFooter>
    </div>
  );
}
