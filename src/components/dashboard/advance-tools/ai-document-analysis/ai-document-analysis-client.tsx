
'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, ScanSearch, Loader2, UploadCloud, AlertTriangle, FileText, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { ExtractDocumentInfoInput, ExtractDocumentInfoOutput } from '@/types/server-only';
import AiDocumentAnalysisLoading from '@/app/dashboard/advance-tools/ai-document-analysis/loading';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const MAX_FILE_SIZE_MB = 3; // Reduced size
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function AiDocumentAnalysisClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, updateGlobalUserProfile, isViewingOwnAccount, currentTeamOwnerProfile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractDocumentInfoOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseAI = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiDocumentAnalysis;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFile(null); setImagePreview(null);
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setAnalysisResult(null); // Clear previous results
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please upload a document image to analyze.", variant: "destructive" });
      return;
    }
    if (!canUseAI) {
      toast({ title: "Permission Denied", description: "You do not have permission to use this feature.", variant: "destructive" });
      return;
    }
    if (!imagePreview || !user || !userProfile || !dataOwnerId) { 
      toast({ title: "Error", description: "Image preview or user data not available.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const input: ExtractDocumentInfoInput = { 
        imageDataUri: imagePreview, 
        userId: dataOwnerId,
        actorUid: user.uid,
        actorName: userProfile.fullName ?? undefined,
      };
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ai/extract-document-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
        body: JSON.stringify(input)
      });
      
      const result: ExtractDocumentInfoOutput = await response.json();
      if(!response.ok) {
        throw new Error(result.error || "Failed to analyze document.");
      }

      setAnalysisResult(result);
      if (result.newResourcePoints !== undefined && dataOwnerId === user.uid && updateGlobalUserProfile && userProfile) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() } });
      }
      toast({ title: "Analysis Complete", description: "AI has processed the document." });
    } catch (error: any) {
      console.error("Error analyzing document:", error);
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) {
    return <AiDocumentAnalysisLoading />;
  }
  if (!user) {
    return <AiDocumentAnalysisLoading />; // Or redirect
  }
  if (!canUseAI && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to use AI Document Analysis.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <ScanSearch className="mr-3 h-7 w-7 text-primary" /> AI Document Analysis (OCR)
          </h1>
          <p className="text-muted-foreground">
            Upload a document image (e.g., invoice, receipt) to extract text and key information.
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
          <CardTitle>Upload Document Image</CardTitle>
          <CardDescription>
            Choose an image file (JPG, PNG, WEBP) of the document you want to analyze. Max {MAX_FILE_SIZE_MB}MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              id="documentUpload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="flex-grow"
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0">
              <UploadCloud className="mr-2 h-4 w-4" /> Choose Image
            </Button>
          </div>
          {imagePreview && (
            <div className="mt-4 p-2 border rounded-md max-h-96 overflow-auto">
              <Image src={imagePreview} alt="Document Preview" width={600} height={800} className="w-full h-auto object-contain rounded-md" data-ai-hint="document scan"/>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleAnalyzeDocument} disabled={!selectedFile || isAnalyzing}>
            {isAnalyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <><BrainCircuit className="mr-2 h-4 w-4" /> Analyze Document</>
            )}
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            {analysisResult.detectedType && <CardDescription>Detected Document Type: {analysisResult.detectedType}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisResult.analysis && (
              <div>
                <h3 className="font-semibold mb-2 text-primary">AI Analysis & Summary:</h3>
                <div className="text-sm whitespace-pre-wrap bg-secondary/50 p-3 rounded-md border">{analysisResult.analysis}</div>
              </div>
            )}
            
            {analysisResult.keyValues && analysisResult.keyValues.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-primary">Extracted Key Information:</h3>
                <ul className="space-y-1 text-sm list-disc list-inside bg-secondary/50 p-3 rounded-md border">
                  {analysisResult.keyValues.map((kv, index) => (
                    <li key={index}><strong>{kv.key}:</strong> {kv.value}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-primary flex items-center"><FileText className="mr-2 h-4 w-4" /> Full Extracted Text:</h3>
              <Textarea value={analysisResult.extractedText} readOnly rows={10} className="text-xs bg-background" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
