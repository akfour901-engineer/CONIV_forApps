

'use client';

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, UploadCloud, ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import NewSorRateLoading from './loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { SOR_RATE_CREATION_COST } from '@/lib/constants';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

const sorRateBulkItemSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50),
  itemDescription: z.string().min(1, "Description is required.").max(500),
  unit: z.string().min(1, "Unit is required.").max(20),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
});

type ParsedSorItem = z.infer<typeof sorRateBulkItemSchema>;

export default function BulkImportSorPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [parsedData, setParsedData] = useState<ParsedSorItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');

  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canManageOwnerSORs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerSORs;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: ["itemCode", "itemDescription", "unit", "rate"] });
          
          const dataToParse = json.slice(1); // Assuming the first row is headers

          const validationResult = z.array(sorRateBulkItemSchema).safeParse(dataToParse);
          if (!validationResult.success) {
            console.error(validationResult.error.flatten());
            toast({ title: "Validation Error", description: "CSV format is incorrect or some rows have missing/invalid data. Please check the required format.", variant: "destructive" });
            setParsedData([]);
            return;
          }
          setParsedData(validationResult.data);
          toast({ title: "File Parsed", description: `${validationResult.data.length} records ready for import.` });
        } catch (error) {
          console.error("Error parsing CSV:", error);
          toast({ title: "Parsing Error", description: "Failed to parse the file. Ensure it's a valid CSV.", variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSubmit = async () => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Error", description: "Cannot process request. User or config data missing.", variant: "destructive" });
      return;
    }

    const itemsToCreate = parsedData.map(item => ({ ...item, visibility }));

    const cost = appConfig.actionCosts?.find(c => c.key === 'SOR_RATE_CREATION_COST')?.cost ?? SOR_RATE_CREATION_COST;
    const privateItemsCount = itemsToCreate.filter(item => item.visibility === 'private').length;
    const totalCost = privateItemsCount * cost;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (totalCost > 0 && currentPoints < totalCost) {
      setPointsInfo({ required: totalCost, current: currentPoints });
      setIsPointsDialogOpen(true);
      return;
    }
    
    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/sor-rates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ items: itemsToCreate, dataOwnerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to import data.');

      if (updateGlobalUserProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
      }
      
      toast({ title: "Import Successful", description: `${result.itemsAdded} items have been added to your SOR.` });
      router.push('/dashboard/sor-rates');
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) return <NewSorRateLoading />;
  if (!canManageOwnerSORs) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage SOR Rates.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/sor-rates">Back to SOR</Link></Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div><h1 className="text-2xl font-semibold flex items-center"><UploadCloud className="mr-3 h-7 w-7 text-primary"/> Bulk Import SOR Rates</h1><p className="text-muted-foreground">Upload a CSV file to add multiple SOR items at once.</p></div>
          <Button variant="outline" asChild><Link href="/dashboard/sor-rates"><ArrowLeft className="mr-2 h-4 w-4"/> Back to SOR Rates</Link></Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Prepare & Upload Your CSV File</CardTitle>
            <CardDescription>
              Create a CSV file with four columns in this exact order: `itemCode`, `itemDescription`, `unit`, `rate`.
              The file should **not** have a header row. <a href="/sor-bulk-import-template.csv" download className="text-primary underline">Download a template here.</a>
            </CardDescription>
          </CardHeader>
          <CardContent><Input type="file" accept=".csv" onChange={handleFileChange} /></CardContent>
        </Card>

        {parsedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Review and Confirm Import</CardTitle>
              <CardDescription>
                Review the parsed data below. Found {parsedData.length} records in  `{fileName}`.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mb-4">
                    <Label>Visibility for Imported Items</Label>
                    <RadioGroup onValueChange={(v) => setVisibility(v as 'private' | 'public')} value={visibility} className="flex gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="private" id="vis-private"/><Label htmlFor="vis-private" className="font-normal">Private (Costs points)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="public" id="vis-public"/><Label htmlFor="vis-public" className="font-normal">Public (Free)</Label></div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                        Public items are visible to all users. Private items are only visible to your team.
                        Creating private items will deduct resource points.
                    </p>
                </div>
              <div className="h-64 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell>{item.itemDescription}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.rate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Importing...</> : <>Confirm & Import Data</>}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </>
  );
}
