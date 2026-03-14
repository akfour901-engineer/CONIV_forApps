
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="h-full grid md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr] gap-4">
        {/* Chat list skeleton */}
        <div className="hidden md:flex flex-col gap-2 p-2 border rounded-lg">
            <Skeleton className="h-8 w-1/3 mb-2" />
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col gap-1 p-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            ))}
        </div>
        
        {/* Main chat window skeleton */}
        <div className="border rounded-lg flex flex-col h-full">
            <div className="p-4 border-b">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </div>
            <div className="flex-1 p-4 space-y-4">
                <div className="flex justify-end items-end gap-2">
                    <Skeleton className="h-16 w-48 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex justify-start items-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-20 w-64 rounded-lg" />
                </div>
                 <div className="flex justify-end items-end gap-2">
                    <Skeleton className="h-10 w-32 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>
            <div className="p-4 border-t flex items-center gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-10" />
                 <Skeleton className="h-10 w-10" />
            </div>
        </div>
    </div>
  );
}
