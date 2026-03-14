import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Logo from "@/components/logo";

export default function NewFollowUpLoadingSkeleton() {
  return (
     <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center justify-center">
        <Logo
          iconClassName="h-16 w-16 text-primary animate-spin"
          iconOnly={true}
        />
        <p className="mt-4 animate-pulse text-sm font-medium text-muted-foreground">
          Loading Follow-up Form...
        </p>
      </div>
    </div>
  );
}