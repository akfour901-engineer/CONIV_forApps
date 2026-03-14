'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Package, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import AiMaterialsForecasterLoading from './loading';
import type { MaterialsForecasterOutput } from '@/ai/flows/materials-forecaster-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function AiMaterialsForecasterClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<MaterialsForecasterOutput, 'newResourcePoints'> | null>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

    const handleAnalyze = async () => {
        if (!user || !userProfile || !dataOwnerId) return;
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/materials-forecaster', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    userId: dataOwnerId,
                    actorUid: user.uid,
                    actorName: userProfile.fullName || undefined,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get forecast.');
            }

            const result: MaterialsForecasterOutput = await response.json();

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Forecast Complete", description: "Your material forecast is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading) return <AiMaterialsForecasterLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
                 <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Package className="mr-3 h-7 w-7 text-primary" />AI Materials Forecaster</h1>
                    <p className="text-muted-foreground">Forecast material needs based on upcoming projects and current inventory.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Materials Forecast</CardTitle>
                    <CardDescription>The AI will analyze all your `approved` and `in-progress` Work Orders against your current inventory to identify potential shortages.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Forecasting...</> : <><Bot className="mr-2 h-4 w-4" />Generate Forecast</>}
                    </Button>
                </CardFooter>
            </Card>
            
            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Material Requirements Report</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-primary mb-1">Shortage Summary</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.shortageSummary}</p>
                        </div>
                        <Separator />
                        {analysisResult.procurementList.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-destructive mb-2">Procurement List</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-right">Required</TableHead>
                                            <TableHead className="text-right">In Stock</TableHead>
                                            <TableHead className="text-right">Shortfall</TableHead>
                                            <TableHead className="text-right">Est. Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysisResult.procurementList.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.itemName}</TableCell>
                                                <TableCell className="text-right">{item.requiredStock}</TableCell>
                                                <TableCell className="text-right">{item.currentStock}</TableCell>
                                                <TableCell className="text-right font-bold text-destructive">{item.shortfall}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.estimatedCost)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-yellow-600 mb-1">Risk Analysis</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.riskAnalysis}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}