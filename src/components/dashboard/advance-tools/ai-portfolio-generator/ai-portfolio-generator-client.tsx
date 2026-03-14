
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import type { GeneratePortfolioInput, GeneratePortfolioOutput, Company } from '@/types';
import { ArrowLeft, Bot, Loader2, Workflow, AlertTriangle, Check, X, PlusCircle, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import AiPortfolioGeneratorLoading from '@/app/dashboard/advance-tools/ai-portfolio-generator/loading';

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

const serviceSchema = z.object({
  title: z.string().min(1, "Service title is required."),
  description: z.string().min(1, "Service description is required."),
  imageUrl: z.string().optional().or(z.literal('')),
});

const projectSchema = z.object({
  title: z.string().min(1, "Project title is required."),
  description: z.string().min(1, "Project description is required."),
  imageUrl: z.string().optional().or(z.literal('')),
});

const portfolioQuestionsSchema = z.object({
    portfolioName: z.string().min(3, "Portfolio name is required."),
    publicId: z.string().min(3, "URL path must be at least 3 characters.").regex(/^[a-z0-9-]+$/, "URL path can only contain lowercase letters, numbers, and hyphens."),
    aboutUs: z.string().min(20, "Please provide a brief 'About Us' section."),
    logoUrl: z.string().optional().or(z.literal('')),
    services: z.array(serviceSchema).optional(),
    projects: z.array(projectSchema).optional(),
    socials: z.object({
        facebook: z.string().url().optional().or(z.literal('')),
        twitter: z.string().url().optional().or(z.literal('')),
        linkedin: z.string().url().optional().or(z.literal('')),
        instagram: z.string().url().optional().or(z.literal('')),
    }).optional(),
    prompt: z.string().optional(),
});

type PortfolioQuestionsValues = z.infer<typeof portfolioQuestionsSchema>;


export default function AiPortfolioGeneratorClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isGenerating, setIsGenerating] = useState(false);
    const [publicId, setPublicId] = useState('');
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
    const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle');
    const debouncedPublicId = useDebounce(publicId, 500);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageCompanies;

    const form = useForm<PortfolioQuestionsValues>({
        resolver: zodResolver(portfolioQuestionsSchema),
        defaultValues: { services: [{title: "", description: "", imageUrl: ""}], projects: [{title: "", description: "", imageUrl: ""}] },
    });

    const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({ control: form.control, name: "services" });
    const { fields: projectFields, append: appendProject, remove: removeProject } = useFieldArray({ control: form.control, name: "projects" });

    useEffect(() => {
      const checkAvailability = async () => {
        if (!debouncedPublicId || debouncedPublicId.length < 3) {
          setAvailabilityStatus('idle');
          return;
        }
        if (!/^[a-z0-9-]+$/.test(debouncedPublicId)) {
          setAvailabilityStatus('invalid');
          return;
        }

        setIsCheckingAvailability(true);
        try {
          const response = await fetch('/api/portfolios/check-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId: debouncedPublicId }),
          });
          const result = await response.json();
          setAvailabilityStatus(result.available ? 'available' : 'taken');
        } catch (error) {
          setAvailabilityStatus('idle');
        } finally {
          setIsCheckingAvailability(false);
        }
      };

      checkAvailability();
    }, [debouncedPublicId]);
    
    const handleFileChange = (
      event: React.ChangeEvent<HTMLInputElement>,
      onChange: (value: string) => void
    ) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_BYTES / (1024*1024)}MB`, variant: "destructive"});
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    };

    const onSubmit = async (values: PortfolioQuestionsValues) => {
        if (availabilityStatus !== 'available') {
            toast({ title: "Invalid URL Path", description: "Please choose a valid and available URL path.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId) return;

        setIsGenerating(true);
        
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/generate-portfolio-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                    userId: dataOwnerId,
                    portfolioType: 'allCompanies', // This can be default as we are using detailed prompt
                    prompt: JSON.stringify(values),
                    publicId: values.publicId,
                    portfolioId: undefined, // Explicitly undefined for creation
                } as GeneratePortfolioInput),
            });
            const result: GeneratePortfolioOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to generate portfolio.');
            
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Portfolio Generated!", description: "Your new portfolio is now live." });
            router.push('/dashboard/portfolios');
        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };
    
    if(authLoading) return <AiPortfolioGeneratorLoading />;

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

     const renderAvailabilityIndicator = () => {
        if (isCheckingAvailability) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (availabilityStatus === 'available') return <Check className="h-4 w-4 text-green-500" />;
        if (availabilityStatus === 'taken' || availabilityStatus === 'invalid') return <X className="h-4 w-4 text-destructive" />;
        return null;
    };

    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Workflow className="mr-3 h-7 w-7 text-primary" />AI Portfolio Generator</h1>
                    <p className="text-muted-foreground">Generate a public portfolio webpage for your business.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>1. Basic Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="portfolioName" render={({ field }) => (<FormItem><FormLabel>Portfolio Name*</FormLabel><FormControl><Input placeholder="e.g., Acme Construction Co." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="publicId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Public URL Path*</FormLabel>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{typeof window !== 'undefined' ? `${window.location.origin}/p/` : '.../'}</div>
                                        <Input {...field} placeholder="my-company-profile" value={publicId} onChange={(e) => { field.onChange(e); setPublicId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} className="pl-48" />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">{renderAvailabilityIndicator()}</div>
                                    </div>
                                    {availabilityStatus === 'invalid' && <p className="text-xs text-destructive mt-1">Path can only contain lowercase letters, numbers, and hyphens, and must be at least 3 characters long.</p>}
                                    {availabilityStatus === 'taken' && <p className="text-xs text-destructive mt-1">This URL path is already taken.</p>}
                                    {availabilityStatus === 'available' && <p className="text-xs text-green-600 mt-1">This URL is available!</p>}
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem><FormLabel>Company Logo</FormLabel><FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>2. Content Sections</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <FormField control={form.control} name="aboutUs" render={({ field }) => (<FormItem><FormLabel>About Us*</FormLabel><FormControl><Textarea placeholder="Describe your company's mission, values, and expertise." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                            
                             <div>
                                <h3 className="text-md font-medium mb-2">Services</h3>
                                {serviceFields.map((field, index) => (
                                    <div key={field.id} className="p-3 border rounded-md mb-2 space-y-2 relative">
                                        <FormField control={form.control} name={`services.${index}.title`} render={({ field }) => (<FormItem><FormLabel>Service Title*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={form.control} name={`services.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Service Description*</FormLabel><FormControl><Textarea {...field} rows={2}/></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={form.control} name={`services.${index}.imageUrl`} render={({ field }) => (<FormItem><FormLabel>Image</FormLabel><FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>)}/>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)} className="absolute top-1 right-1 h-6 w-6"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendService({title: "", description: "", imageUrl: ""})}><PlusCircle className="mr-2 h-4 w-4"/>Add Service</Button>
                            </div>
                            
                            <div>
                                <h3 className="text-md font-medium mb-2">Projects</h3>
                                {projectFields.map((field, index) => (
                                     <div key={field.id} className="p-3 border rounded-md mb-2 space-y-2 relative">
                                        <FormField control={form.control} name={`projects.${index}.title`} render={({ field }) => (<FormItem><FormLabel>Project Title*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={form.control} name={`projects.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Project Description*</FormLabel><FormControl><Textarea {...field} rows={2}/></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={form.control} name={`projects.${index}.imageUrl`} render={({ field }) => (<FormItem><FormLabel>Image</FormLabel><FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>)}/>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeProject(index)} className="absolute top-1 right-1 h-6 w-6"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendProject({title: "", description: "", imageUrl: ""})}><PlusCircle className="mr-2 h-4 w-4"/>Add Project</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>3. Social & Contact</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="grid md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="socials.facebook" render={({ field }) => (<FormItem><FormLabel>Facebook URL</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="socials.twitter" render={({ field }) => (<FormItem><FormLabel>Twitter/X URL</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="socials.linkedin" render={({ field }) => (<FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="socials.instagram" render={({ field }) => (<FormItem><FormLabel>Instagram URL</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle>4. Final Instructions</CardTitle></CardHeader>
                        <CardContent>
                            <FormField control={form.control} name="prompt" render={({ field }) => (<FormItem><FormLabel>Additional Instructions for AI (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., 'Use a dark theme', 'Make the design very modern and minimalist'." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isGenerating || isCheckingAvailability || availabilityStatus !== 'available'}>
                                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Portfolio...</> : <><Bot className="mr-2 h-4 w-4" />Generate</>}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}
