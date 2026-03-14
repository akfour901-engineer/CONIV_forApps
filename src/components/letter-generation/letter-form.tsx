
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, FileSignature, Sparkles, PlusCircle, Trash2, Download, Edit, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Letter, LETTER_CERTIFICATE_GENERATION_COST } from '@/types/server-only';
import LetterGenerationLoadingSkeleton from '@/app/dashboard/letter-generation/loading';
import { marked } from 'marked';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { Separator } from '../ui/separator';
import LetterPrintModal from './letter-print-modal';

const keyValuePairSchema = z.object({
  key: z.string().min(1, "Key cannot be empty."),
  value: z.string().min(1, "Value cannot be empty."),
});

const formSchema = z.object({
  documentType: z.enum(['Letter', 'Certificate']),
  recipient: z.string().min(1, "Recipient is required."),
  subject: z.string().min(1, "Subject is required."),
  context: z.string().min(10, "Context must be at least 10 characters.").max(2000),
  customFields: z.array(keyValuePairSchema).optional(),
  generatedTitle: z.string().optional(),
  generatedContent: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LetterFormProps {
    letterId?: string;
}

export default function LetterForm({ letterId }: LetterFormProps) {
  const { user, dataOwnerId, userProfile, appConfig, updateGlobalUserProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const [letter, setLetter] = useState<Letter | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const isEditing = !!letterId;
  const canGenerateLetters = isViewingOwnAccount || !!currentTeamMemberPermissions?.canGenerateLetters;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentType: 'Letter',
      recipient: '',
      subject: '',
      context: '',
      customFields: [],
      generatedTitle: '',
      generatedContent: ''
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'customFields',
  });

  useEffect(() => {
    if (isEditing && user) {
        const fetchLetter = async () => {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/letters/${letterId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
            if (response.ok) {
                const data = await response.json();
                setLetter(data);
                form.reset(data);
            } else {
                toast({ title: "Error", description: "Failed to load letter data.", variant: "destructive" });
                router.push('/dashboard/letter-generation');
            }
        };
        fetchLetter();
    }
  }, [isEditing, letterId, user, form, toast, router]);

  const handleGenerate = async () => {
    const values = form.getValues();
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;
    
    const cost = appConfig.actionCosts?.find(c => c.key === 'LETTER_CERTIFICATE_GENERATION_COST')?.cost ?? LETTER_CERTIFICATE_GENERATION_COST;
    if ((userProfile.resourcePoints ?? 0) < cost) {
      setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
      setIsPointsDialogOpen(true);
      return;
    }

    setIsGenerating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/letters/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, userId: dataOwnerId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate document.');
      
      form.setValue('generatedTitle', result.title);
      form.setValue('generatedContent', result.content);
      if (result.newResourcePoints !== undefined && updateGlobalUserProfile) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } }, user);
      }
      toast({ title: "Document Generated", description: `Cost: ${cost} points.` });
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSave = async () => {
    const values = form.getValues();
    if (!user || !dataOwnerId) return;

    setIsSaving(true);
    try {
        const idToken = await user.getIdToken();
        const url = isEditing ? `/api/letters/${letterId}` : '/api/letters';
        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, userId: dataOwnerId })
        });
        if (!response.ok) throw new Error((await response.json()).error || `Failed to ${isEditing ? 'update' : 'save'} letter.`);
        toast({ title: "Success", description: `Letter ${isEditing ? 'updated' : 'saved'}.` });
        router.push('/dashboard/letter-generation');
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!form.getValues('generatedContent')) {
        toast({title: "No Content", description: "Please generate a document first.", variant: "destructive"})
        return;
    }
    setIsPrintModalOpen(true);
  };
  
  if (authLoading && !userProfile) return <LetterGenerationLoadingSkeleton />;
  if (!canGenerateLetters) {
      return <div>You do not have permission to access this feature.</div>
  }

  return (
    <>
    <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
    <LetterPrintModal isOpen={isPrintModalOpen} onOpenChange={setIsPrintModalOpen} letter={form.getValues()} />
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            {isEditing ? <Edit className="mr-3 h-7 w-7 text-primary" /> : <PlusCircle className="mr-3 h-7 w-7 text-primary" />}
            {isEditing ? 'Edit Letter/Certificate' : 'Generate Letter/Certificate'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Modify the saved document.' : 'Use AI to generate professional documents.'}
          </p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/letter-generation"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
      </div>

      <Form {...form}>
        <form className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Input Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="documentType" render={({ field }) => (
                  <FormItem><FormLabel>Document Type*</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Letter">Letter</SelectItem><SelectItem value="Certificate">Certificate</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="recipient" render={({ field }) => (<FormItem><FormLabel>Recipient*</FormLabel><FormControl><Input placeholder="e.g., The Branch Manager, SBI" {...field} /></FormControl><FormMessage /></FormItem>)}/>
              </div>
              <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject / Title*</FormLabel><FormControl><Input placeholder="e.g., Request for Bank Statement" {...field} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="context" render={({ field }) => (<FormItem><FormLabel>Context / Main Content*</FormLabel><FormControl><Textarea placeholder="Provide all necessary details..." {...field} rows={5} /></FormControl><FormMessage /></FormItem>)}/>
              <div>
                <FormLabel>Custom Fields (Optional)</FormLabel>
                <div className="space-y-2 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <FormField control={form.control} name={`customFields.${index}.key`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Key" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`customFields.${index}.value`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Value" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ key: '', value: '' })}><PlusCircle className="mr-2 h-4 w-4" />Add Field</Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="button" onClick={handleGenerate} disabled={isGenerating}>{isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</> : <><Sparkles className="mr-2 h-4 w-4"/>Generate with AI</>}</Button>
            </CardFooter>
          </Card>
          
          <Card>
              <CardHeader>
                  <CardTitle>Generated Document</CardTitle>
                  <CardDescription>Review, edit, and save the generated document.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <FormField control={form.control} name="generatedTitle" render={({ field }) => (<FormItem><FormLabel>Generated Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="generatedContent" render={({ field }) => (<FormItem><FormLabel>Generated Content (Markdown)</FormLabel><FormControl><Textarea {...field} rows={20} /></FormControl></FormItem>)} />
              </CardContent>
              <CardFooter className="gap-2">
                  <Button type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" />Save</>}</Button>
                  <Button type="button" onClick={handleDownload} variant="secondary" disabled={!form.getValues('generatedContent')}><Download className="mr-2 h-4 w-4"/>Download as PDF</Button>
              </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
    </>
  );
}
