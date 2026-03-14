
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { marked } from 'marked';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLoading } from '@/contexts/loading-context';

interface LegalDocumentDisplayProps {
  title: string;
  content: string;
}

export default function LegalDocumentDisplay({ title, content }: LegalDocumentDisplayProps) {
  const { setIsLoading } = useLoading();
  const htmlContent = content ? marked.parse(content) as string : '';

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
       <Button variant="outline" size="sm" asChild className="mb-4">
        <Link href="/auth/signup" onClick={() => setIsLoading(true)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign Up
        </Link>
       </Button>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
