
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Loader2, Sparkles, AlertTriangle, PlusCircle, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { marked } from 'marked';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { AI_MARKETING_CONTENT_GENERATION_COST } from '@/lib/constants';
import type { GenerateMarketingContentOutput, Company, GenerateMarketingContentInput } from '@/types/server-only';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import AiContentGeneratorLoading from '@/app/dashboard/marketing/content-generator/loading';

const productOrServiceSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  imageUrl: z.string().optional().nullable(),
});

const contentGeneratorSchema = z.object({
  contentName: z.string().min(3, "Content name is required."),
  prompt: z.string().min(10, "A detailed prompt is required to generate quality content."),
  companyId: z.string().optional().nullable(),
  products: z.array(productOrServiceSchema).optional(),
});

type ContentGeneratorFormValues = z.infer<typeof contentGeneratorSchema>;

export default function AiContentGeneratorClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile, appConfig } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationResult, setGenerationResult] = useState<Omit<GenerateMarketingContentOutput, 'newResourcePoints'> | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    
    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageMailingList;

    const form = useForm<ContentGeneratorFormValues>({
        resolver: zodResolver(contentGeneratorSchema),
        defaultValues: {
            contentName: "",
            prompt: "",
            companyId: null,
            products: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "products",
    });
    
    useEffect(() => {
        if (user && dataOwnerId) {
            const fetchCompanies = async () => {
                setIsLoadingCompanies(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
                    if (!response.ok) throw new Error("Failed to fetch companies.");
                    const data: Company[] = await response.json();
                    setCompanies(data.map(c => ({ value: c.id!, label: c.name })));
                } catch (e: any) {
                    toast({ title: "Error", description: `Could not load companies: ${e.message}`, variant: "destructive" });
                } finally {
                    setIsLoadingCompanies(false);
                }
            };
            fetchCompanies();
        }
    }, [user, dataOwnerId, toast]);

    const handleFileChange = (
      event: React.ChangeEvent<HTMLInputElement>,
      onChange: (value: string) => void
    ) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > 1024 * 1024) { // 1MB limit
          toast({ title: "File Too Large", description: `Max 1MB`, variant: "destructive"});
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
      }
    };


    const handleGenerate = async (values: ContentGeneratorFormValues) => {
        if (!user || !userProfile || !dataOwnerId || !appConfig) return;

        const cost = appConfig?.actionCosts?.find(c => c.key === 'AI_MARKETING_CONTENT_GENERATION_COST')?.cost ?? AI_MARKETING_CONTENT_GENERATION_COST;
        const currentPoints = userProfile.resourcePoints ?? 0;
        if (currentPoints < cost) {
            setPointsInfo({ required: cost, current: currentPoints });
            setIsPointsDialogOpen(true);
            return;
        }

        setIsGenerating(true);
        setGenerationResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/marketing/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ 
                    userId: dataOwnerId, 
                    contentName: values.contentName, 
                    prompt: values.prompt, 
                    companyId: values.companyId,
                    products: values.products 
                }),
            });
            const result: GenerateMarketingContentOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to generate content.');

            setGenerationResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Content Generated!", description: `"${values.contentName}" has been saved.` });
        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };
    
    if(authLoading) return <AiContentGeneratorLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
                <Button asChild className="mt-6"><Link href="/dashboard/marketing/mailing-lists"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Lists</Link></Button>
            </div>
        );
    }
    
    return (
        <>
        <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Sparkles className="mr-3 h-7 w-7 text-primary" />AI Marketing Content Generator</h1>
                    <p className="text-muted-foreground">Craft engaging email content for your marketing campaigns.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/marketing/content"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Content List</Link></Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Content & Context</CardTitle>
                            <CardDescription>Give the AI a name, context, and a detailed prompt to generate an email.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="contentName" render={({ field }) => (<FormItem><FormLabel>Content Name*</FormLabel><FormControl><Input placeholder="e.g., Q3 Promo, New Service Intro" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem><FormLabel>Company for Context (Optional)</FormLabel><Combobox options={companies} value={field.value || ''} onChange={(val) => field.onChange(val === '' ? null : val)} placeholder="Select Company..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies} /><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="prompt" render={({ field }) => (<FormItem><FormLabel>AI Prompt / Instructions*</FormLabel><FormControl><Textarea placeholder="e.g., 'Write a friendly email introducing our new eco-friendly construction services...'" {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>2. Product/Service Focus (Optional)</CardTitle>
                            <CardDescription>Provide details on specific products or services to feature in the email.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="p-3 border rounded-md mb-2 space-y-2 relative">
                                    <h4 className="text-sm font-semibold">Item #{index + 1}</h4>
                                    <FormField control={form.control} name={`products.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name={`products.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea {...field} rows={2}/></FormControl><FormMessage /></FormItem>)}/>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="absolute top-1 right-1 h-6 w-6"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({name: "", description: "", imageUrl: null})}><PlusCircle className="mr-2 h-4 w-4"/>Add another item</Button>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isGenerating || !form.formState.isValid}>
                                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Bot className="mr-2 h-4 w-4" />Generate Content</>}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>

            {generationResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Generated Content: `{form.getValues('contentName')}`</CardTitle>
                        <CardDescription>Review the AI-generated subject and body. It has been saved and is now available to use in campaigns.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="subject" className="font-semibold text-primary">Subject</Label>
                            <Input id="subject" readOnly value={generationResult.subject} className="mt-1 bg-secondary/50" />
                        </div>
                         <Separator />
                        <div>
                            <Label htmlFor="body" className="font-semibold text-primary">Body Preview</Label>
                            <div className="prose prose-sm max-w-none mt-2 p-3 border rounded-md" dangerouslySetInnerHTML={{ __html: generationResult.htmlContent || '' }}></div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
        </>
    );
}
