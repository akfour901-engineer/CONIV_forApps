'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Bot, Loader2, Lightbulb, AlertTriangle } from 'lucide-react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import AiEstimateGenerationLoading from './loading';
import { useLoading } from '@/contexts/loading-context';
import type { SuggestEstimateItemsInput, SuggestEstimateItemsOutput, AISuggestedEstimateItem } from '@/types/server-only';

export default function AiEstimateGenerationClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, updateGlobalUserProfile, isViewingOwnAccount, currentTeamOwnerProfile } = useAuth();
  const [projectScope, setProjectScope] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canUseAI = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiEstimateGeneration;

  const handleGetSuggestions = async () => {
    if (!projectScope.trim()) {
      toast({ title: "Input Required", description: "Please enter a project scope description.", variant: "destructive" });
      return;
    }
    if (!canUseAI || !user || !userProfile || !dataOwnerId) {
      toast({ title: "Permission Denied", description: "You do not have permission to use this feature.", variant: "destructive" });
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const input: SuggestEstimateItemsInput = { 
        projectScope, 
        userId: dataOwnerId,
        actorUid: user.uid,
        actorName: userProfile.fullName || userProfile.email || "AI User",
      };
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ai/suggest-estimate-items', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(input)
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get suggestions.');
      }

      const result: SuggestEstimateItemsOutput = await response.json();
      
      if (result.newResourcePoints !== undefined && dataOwnerId === user.uid && updateGlobalUserProfile && userProfile) {
          updateGlobalUserProfile(
            { 
              userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }, 
              teamMemberPermissions: currentTeamMemberPermissions, 
              teamOwnerProfileData: isViewingOwnAccount ? null : currentTeamOwnerProfile
            }, 
            user
          );
      }

      if (result.suggestedItems && result.suggestedItems.length > 0) {
        toast({ title: "Suggestions Received!", description: "Redirecting to create a new estimate with these items." });
        const aiDraft = {
          subjectOfWork: result.subjectOfWork || "Generated from AI",
          items: result.suggestedItems.map((item: any) => ({ description: item.description, unit: item.unit })),
        };
        const queryParam = encodeURIComponent(JSON.stringify(aiDraft));
        router.push(`/dashboard/estimates/new?aiDraft=${queryParam}`);
      } else {
        toast({ title: "No Suggestions", description: "The AI could not generate suggestions for the provided scope. Try rephrasing.", duration: 7000 });
      }
    } catch (error: any) {
      console.error("Error getting AI suggestions:", error);
      toast({ title: "Error", description: error.message || "Failed to get AI suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  if (authLoading) {
    return <AiEstimateGenerationLoading />;
  }

  if (!user) { 
    router.push("/auth/signin");
    return <AiEstimateGenerationLoading />;
  }

  if (!canUseAI && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to use AI Estimate Generation.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Bot className="mr-3 h-7 w-7 text-primary" /> AI-Powered Estimate Generation
          </h1>
          <p className="text-muted-foreground">
            Describe your project scope, and let AI suggest potential line items to kickstart your estimate.
          </p>
        </div>
         <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashboard/advance-tools">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Project Scope</CardTitle>
          <CardDescription>
            Provide a detailed description of the work to be done. The more detail, the better the AI suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., Construction of a 10m x 5m single-story brick shed with a flat concrete roof, including basic electrical wiring and one door, one window..."
            value={projectScope}
            onChange={(e) => setProjectScope(e.target.value)}
            rows={6}
            className="shadow-sm"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleGetSuggestions} disabled={isLoadingSuggestions}>
            {isLoadingSuggestions ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Getting Suggestions & Redirecting...</>
            ) : (
              <><Lightbulb className="mr-2 h-4 w-4" /> Get AI Suggestions & Create Estimate</>
            )}
          </Button>
        </CardFooter>
      </Card>
      
       {(isLoadingSuggestions) && (
         <Card className="shadow-lg">
            <CardHeader><CardTitle>Generating Suggestions...</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </CardContent>
         </Card>
       )}
    </div>
  );
}