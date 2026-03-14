
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CoinsPaymentsLoadingSkeleton() { // Renamed for clarity
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_,i) => (
            <Card key={i} className="shadow-lg">
                <CardHeader> <Skeleton className="h-5 w-24" /> </CardHeader>
                <CardContent> <Skeleton className="h-7 w-32" /> <Skeleton className="h-4 w-40 mt-1"/> </CardContent>
            </Card>
        ))}
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead><Skeleton className="h-5 w-[70%]" /></TableHead><TableHead><Skeleton className="h-5 w-[30%]" /></TableHead></TableRow></TableHeader>
            <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-7 w-1/3 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead><Skeleton className="h-5 w-[20%]" /></TableHead><TableHead><Skeleton className="h-5 w-[40%]" /></TableHead><TableHead className="text-right"><Skeleton className="h-5 w-[20%]" /></TableHead><TableHead className="text-right"><Skeleton className="h-5 w-[20%]" /></TableHead></TableRow></TableHeader>
            <TableBody>
            {[...Array(4)].map((_, i) => (
                <TableRow key={i}><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-full" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
