
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Coins } from 'lucide-react';
import Link from 'next/link';
import { useLoading } from '@/contexts/loading-context';

export function OutOfCoinsOverlay() {
  const { setIsLoading } = useLoading();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <Coins className="mr-2 h-6 w-6" />
            Out of Resource Points
          </CardTitle>
          <CardDescription>
            Your account has run out of resource points. To continue accessing features, please purchase more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Most actions within the app, such as creating documents or using AI tools, require resource points. Replenish your balance to unlock all features.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" onClick={() => setIsLoading(true)}>
            <Link href="/dashboard/coins-payments/buy-coins">
              <Coins className="mr-2 h-4 w-4" /> Buy More Points
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
