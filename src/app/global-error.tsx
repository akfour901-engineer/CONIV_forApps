'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {

  const handleReload = () => {
    // For a global, potentially unrecoverable error, a full reload is often more reliable
    // than just trying to re-render the segment with `reset()`.
    window.location.reload();
  };

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-6 w-6" />
                An Unexpected Error Occurred
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Something went wrong on our end. Please try again in a few moments. If the issue persists, contact support.
              </p>
              {error?.message && (
                <details className="mt-4 text-xs">
                  <summary>Error Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-muted-foreground">
                    <code>{error.message}</code>
                  </pre>
                </details>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleReload} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardFooter>
          </Card>
        </div>
      </body>
    </html>
  );
}
