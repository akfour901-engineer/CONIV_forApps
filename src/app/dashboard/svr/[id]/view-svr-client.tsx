
'use client';

import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Edit, AlertTriangle, FileText, Calendar, ListChecks, Star, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { ServiceVisitReport } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import ViewSvrLoadingSkeleton from './loading';
import Image from 'next/image';

export default function ViewSvrContent({ svrId }: { svrId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [report, setReport] = useState<ServiceVisitReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    if (!svrId) {
      toast({ title: "Error", description: "SVR ID is missing.", variant: "destructive" });
      router.push('/dashboard/svr');
      return;
    }

    const fetchSvr = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/svr/${svrId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch SVR details`);
        }
        setReport(await response.json());
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSvr();
  }, [svrId, user, authLoading, toast, router]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) { return 'Invalid Date'; }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(10)].map((_, i) => (
          <Star key={i} className={`h-5 w-5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        ))}
      </div>
    );
  }

  if (isLoading || authLoading) {
    return <ViewSvrLoadingSkeleton />;
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Report Not Found</h2>
        <p className="text-muted-foreground">The requested service visit report could not be found or you do not have permission to view it.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/svr">Back to SVR List</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center"><FileText className="mr-3 h-7 w-7 text-primary" />Service Visit Report</h1>
          <p className="text-muted-foreground">Details for visit on {formatDate(report.visitDate)} for WO #{report.workOrderNumber}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild><Link href="/dashboard/svr"><ArrowLeft className="mr-2 h-4 w-4" />Back to SVR List</Link></Button>
           <Button asChild><Link href={`/dashboard/svr/${report.id}?edit=true`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>SVR for {report.workOrderNumber}</CardTitle>
          <CardDescription>Created by {report.createdByName} on {format(parseISO(report.createdAt), 'dd MMM yyyy, p')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><strong className="font-medium">Visit Date:</strong>{formatDate(report.visitDate)}</div>
            <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /><strong className="font-medium">Rating:</strong>{renderStars(report.visitRating)}</div>
          </div>
          <div><h4 className="font-semibold text-primary">Purpose of Visit</h4><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{report.purposeOfVisit}</p></div>
          <div><h4 className="font-semibold text-primary">Actions Taken / Work Performed</h4><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{report.actionsTaken}</p></div>
          {report.nextSteps && <div><h4 className="font-semibold text-primary">Next Steps / Follow-up</h4><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{report.nextSteps}</p></div>}
          {report.clientFeedback && <div><h4 className="font-semibold text-primary flex items-center gap-2"><MessageSquare className="h-4 w-4"/>Client Feedback</h4><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{report.clientFeedback}</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
