
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, FileText, ClipboardList, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { AssessDocumentRiskInput, AssessDocumentRiskOutput, Estimate, WorkOrder } from '@/types/server-only';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import AiRiskAssessmentLoading from '@/app/dashboard/advance-tools/ai-risk-assessment/loading';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'next/navigation';

type DocumentType = 'estimates' | 'workOrders';

export default function AiRiskAssessmentClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [documentType, setDocumentType] = useState<DocumentType>('estimates');
  const [documents, setDocuments] = useState<ComboboxOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Omit<AssessDocumentRiskOutput, 'newResourcePoints'> | null>(null);

  const canUseAI = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiRiskAssessment;

  useEffect(() => {
    const docId = searchParams?.get('docId');
    const docType = searchParams?.get('docType');
    if (docType === 'workOrders' || docType === 'workOrder') {
        setDocumentType('workOrders');
        if(docId) setSelectedDocumentId(docId);
    } else if (docType === 'estimates' || docType === 'estimate') {
        setDocumentType('estimates');
        if(docId) setSelectedDocumentId(docId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && dataOwnerId) {
      setIsLoadingDocuments(true);
      const fetchDocuments = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/list-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ dataOwnerId, documentType }),
          });
          if (!response.ok) throw new Error(`Failed to fetch ${documentType}.`);
          const data: (Estimate | WorkOrder)[] = await response.json();
          setDocuments(data.map(doc => ({
            value: doc.id!,
            label: `${'estimateNumber' in doc ? doc.estimateNumber : doc.workOrderNumber} - ${doc.organizationName}`
          })));

           const docId = searchParams?.get('docId');
            if (docId && data.some(doc => doc.id === docId)) {
                setSelectedDocumentId(docId);
            } else if (docId) {
                 setSelectedDocumentId(''); 
            }
          
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
          setIsLoadingDocuments(false);
        }
      };
      fetchDocuments();
    }
  }, [documentType, user, dataOwnerId, toast, searchParams]);

  const handleAnalyze = async () => {
    if (!selectedDocumentId) {
      toast({ title: "No Document Selected", description: "Please select a document to analyze.", variant: "destructive" });
      return;
    }
    if (!canUseAI || !user || !userProfile || !dataOwnerId) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const input: AssessDocumentRiskInput = {
        documentId: selectedDocumentId,
        documentType: documentType === 'estimates' ? 'estimate' : 'workOrder',
        userId: dataOwnerId,
        actorUid: user.uid,
        actorName: userProfile.fullName ?? undefined,
      };
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ai/assess-document-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
        body: JSON.stringify(input)
      });
      
      const result: AssessDocumentRiskOutput = await response.json();
      if(!response.ok) {
        throw new Error(result.error || "Failed to analyze document.");
      }

      setAnalysisResult(result);
      if (result.newResourcePoints !== undefined && dataOwnerId === user.uid && updateGlobalUserProfile && userProfile) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() } });
      }
      toast({ title: "Analysis Complete", description: "AI has assessed the document for potential risks." });
    } catch (error: any) {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) return <AiRiskAssessmentLoading />;
  
  if (!canUseAI && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to use AI Risk Assessment.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <ShieldAlert className="mr-3 h-7 w-7 text-primary" /> AI Risk Assessment
          </h1>
          <p className="text-muted-foreground">Analyze your documents for potential risks before it`s too late.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/advance-tools">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Select Document for Analysis</CardTitle>
          <CardDescription>Choose the document type and then select the specific document to assess.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
            <Select onValueChange={(value) => setDocumentType(value as DocumentType)} defaultValue={documentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="estimates"><div className="flex items-center"><FileText className="mr-2 h-4 w-4"/>Estimates</div></SelectItem>
                    <SelectItem value="workOrders"><div className="flex items-center"><ClipboardList className="mr-2 h-4 w-4"/>Work Orders</div></SelectItem>
                </SelectContent>
            </Select>
            <Combobox
                options={documents}
                value={selectedDocumentId}
                onChange={setSelectedDocumentId}
                placeholder={isLoadingDocuments ? "Loading..." : `Select a document...`}
                searchPlaceholder="Search documents..."
                disabled={isLoadingDocuments || documents.length === 0}
                emptyResultText="No documents found for this type."
            />
        </CardContent>
        <CardFooter>
          <Button onClick={handleAnalyze} disabled={!selectedDocumentId || isAnalyzing}>
            {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Bot className="mr-2 h-4 w-4" />Assess Risk</>}
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-primary mb-1">Overall Summary</h3>
              <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">{analysisResult.auditSummary}</p>
            </div>

            {analysisResult.potentialIssues && analysisResult.potentialIssues.length > 0 && (
              <div>
                <h3 className="font-semibold text-destructive mb-2">Potential Issues Identified</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {analysisResult.potentialIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysisResult.mitigationSuggestions && analysisResult.mitigationSuggestions.length > 0 && (
              <div>
                <h3 className="font-semibold text-green-600 mb-2">Mitigation Suggestions</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {analysisResult.mitigationSuggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
