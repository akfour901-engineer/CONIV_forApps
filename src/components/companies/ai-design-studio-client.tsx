'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { ArrowLeft, Bot, Sparkles, Loader2, RefreshCw, Wand2, Palette, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { generateBranding, type GenerateBrandingInput, type GenerateBrandingOutput } from '@/ai/flows/generate-branding-flow';
import type { Company } from '@/types/server-only';
import AiDesignStudioLoadingSkeleton from '@/app/dashboard/companies/[id]/design-studio/loading';
import { Separator } from '@/components/ui/separator';
import { useLoading } from '@/contexts/loading-context';
import Image from 'next/image';

export default function AiDesignStudioClientPage({ companyId }: { companyId: string }) {
  const { user, userProfile, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [brandingResults, setBrandingResults] = useState<Omit<GenerateBrandingOutput, 'newResourcePoints'> | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchInitialData = async () => {
        try {
          const idToken = await user.getIdToken();
          const [companyRes, brandingRes] = await Promise.all([
            fetch(`/api/companies/${companyId}`, { headers: { Authorization: `Bearer ${idToken}` } }),
            fetch(`/api/companies/${companyId}/branding-results`, { headers: { Authorization: `Bearer ${idToken}` } }),
          ]);

          if (!companyRes.ok) throw new Error("Failed to fetch company details.");
          setCompany(await companyRes.json());
          
          if (brandingRes.ok) {
            const data = await brandingRes.json();
            if (data) {
                setBrandingResults(data);
                if (data.logos && data.logos.length > 0) {
                    setSelectedLogo(data.logos[0]);
                }
            }
          }

        } catch (error: any) {
          toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
        }
      };
      fetchInitialData();
    }
  }, [user, dataOwnerId, companyId, toast]);

  const handleGenerate = async () => {
    if (!company || !user || !dataOwnerId || !userProfile) return;
    setIsGenerating(true);
    try {
      const input: GenerateBrandingInput = {
        userId: dataOwnerId,
        companyId: company.id!,
        prompt: prompt,
        actorUid: user.uid,
      };
      const result = await generateBranding(input);
      setBrandingResults(result);
      if(result.logos && result.logos.length > 0) setSelectedLogo(result.logos[0]);

      if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
      }
      toast({ title: "Branding Generated", description: "New logos and letterheads are ready." });
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleRegenerateLogo = async () => {
      if(!selectedLogo || !company || !user || !dataOwnerId || !userProfile) return;
      setIsGenerating(true);
      try {
          const input: GenerateBrandingInput = {
              userId: dataOwnerId,
              companyId: company.id!,
              regenerateLogo: true,
              logoToRegenerate: selectedLogo,
          };
          const result = await generateBranding(input);
          if (result.logos && result.logos.length > 0) {
              const newLogo = result.logos[0];
              const updatedLogos = brandingResults?.logos.map(logo => logo === selectedLogo ? newLogo : logo) || [newLogo];
              setBrandingResults(prev => ({...prev!, logos: updatedLogos}));
              setSelectedLogo(newLogo);
          }
      } catch (e: any) {
          toast({ title: "Regeneration Failed", description: e.message, variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const handleUseLogo = async (logoSvg: string) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    setIsSavingLogo(true);
    try {
      // Correctly format the raw SVG into a data URI
      const base64Svg = btoa(logoSvg);
      const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ logoUrl: dataUri }),
      });

      if (!response.ok) {
        throw new Error('Failed to update company logo.');
      }
      toast({ title: "Logo Updated!", description: "The new logo has been set for this company." });
      // Optionally, refetch company data or navigate away
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingLogo(false);
    }
  };

  if (authLoading || !company) {
    return <AiDesignStudioLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Wand2 className="mr-3 h-7 w-7 text-primary" /> AI Design Studio
          </h1>
          <p className="text-muted-foreground">
            Generate logos and letterheads for: <strong>{company.name}</strong>
          </p>
        </div>
        <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
          <Link href={`/dashboard/companies/${companyId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Company
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Branding Assets</CardTitle>
          <CardDescription>
            Provide a simple prompt to guide the AI, e.g., `modern and minimal using the letter C`, or leave it blank for a completely new idea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., A simple logo with a hammer and a gear..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</> : <><Sparkles className="mr-2 h-4 w-4"/>Generate</>}
          </Button>
        </CardFooter>
      </Card>
      
      {brandingResults && (
        <Card>
          <CardHeader><CardTitle>Generated Logos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {brandingResults.logos.map((logo, index) => (
                  <div key={index} className={`p-2 border rounded-md cursor-pointer ${selectedLogo === logo ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedLogo(logo)}>
                      <div className="bg-gray-100 p-2 rounded">
                          <div dangerouslySetInnerHTML={{ __html: logo }} className="w-full h-24" />
                      </div>
                  </div>
              ))}
          </CardContent>
          {selectedLogo && (
            <CardFooter className="flex items-center gap-2">
                <Button onClick={() => handleUseLogo(selectedLogo)} disabled={isSavingLogo}>
                    {isSavingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>} Use Selected Logo
                </Button>
                <Button variant="outline" onClick={handleRegenerateLogo} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>} Regenerate
                </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {brandingResults && (
        <Card>
          <CardHeader><CardTitle>Generated Letterheads</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {brandingResults.letterheads.map((lh, index) => {
              const fullHtml = `<style>${lh.css.replace(/\{\{/g, '{{ ').replace(/\}\}/g,' }}')}</style>${lh.html.replace(/\{\{logo\}\}/g, selectedLogo || '')}`.replace(/{{companyName}}/g, company?.name || 'Company Name').replace(/{{address}}/g, company?.address || 'Company Address').replace(/{{contact}}/g, `${company?.contactPhone || ''} | ${company?.contactEmail || ''}`);
              return (
                <div key={index}>
                  <h4 className="font-semibold mb-2">{lh.name}</h4>
                  <div className="border rounded-md p-4 bg-white" dangerouslySetInnerHTML={{ __html: fullHtml }}></div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

