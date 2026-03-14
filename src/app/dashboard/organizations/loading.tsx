
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OrganizationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-10 w-1/4" />
      </div>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-3/5" /> 
                <Skeleton className="h-5 w-1/5" />
              </div>
              <Skeleton className="h-4 w-2/5 mt-1" />
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
             <CardFooter className="border-t pt-4 mt-2 flex items-center space-x-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-9 rounded" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
