
'use client';

import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { MailingListContent, GenerateMarketingContentInput } from '@/types/server-only';
import { Save, Loader2, ArrowLeft, RefreshCw, Bot } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { marked } from 'marked';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import MailingListLoading from '@/app/dashboard/marketing/content/loading';

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill');
    // The type for the ref is complex, using `any` for simplicity here
    const QuillComponent = ({ forwardedRef, ...props }: any) => <RQ ref={forwardedRef} {...props} />;
    QuillComponent.displayName = 'ReactQuill';
    return QuillComponent;
  },
  {
    ssr: false,
    loading: () => <div className="h-64 bg-gray-100 rounded-md animate-pulse" />
  }
);


const contentFormSchema = z.object({
  contentName: z.string().min(3, "Content name is required."),
  subject: z.string().min(3, "Subject is required."),
  htmlContent: z.string().min(10, "Body cannot be empty."),
});

type ContentFormValues = z.infer<typeof contentFormSchema>;

interface EditMarketingContentClientProps {
  contentId: string;
}

export default function EditMarketingContentClient({ contentId }: EditMarketingContentClientProps) {
    const { user, dataOwnerId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [rebuildPrompt, setRebuildPrompt] = useState('');
    const quillRef = useRef<any>(null);


    const form = useForm<ContentFormValues>({
        resolver: zodResolver(contentFormSchema),
    });

    useEffect(() => {
        if (user && dataOwnerId && contentId) {
            const fetchContent = async () => {
                setIsLoading(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/marketing/content/${contentId}`, {
                        headers: { 'Authorization': `Bearer ${idToken}` }
                    });
                    if (!response.ok) throw new Error('Failed to fetch content.');
                    const data: MailingListContent = await response.json();
                    form.reset({
                        contentName: data.contentName,
                        subject: data.subject,
                        htmlContent: data.htmlContent,
                    });
                } catch (error: any) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchContent();
        }
    }, [user, dataOwnerId, contentId, toast, form]);

    const imageHandler = useCallback(async () => {
      if (!user) return;

      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
          const idToken = await user.getIdToken();
          const formData = new FormData();
          formData.append('image', file);

          const response = await fetch('/api/upload/image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: formData,
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Image upload failed.');
          
          const quill = quillRef.current?.getEditor();
          const range = quill.getSelection(true); // Get the current selection range
          quill.insertEmbed(range.index, 'image', result.url);
        } catch (error: any) {
          toast({ title: 'Image Upload Error', description: error.message, variant: 'destructive' });
        }
      };
    }, [user, toast]);
    
    const modules = useMemo(() => ({
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }, { 'font': [] }],
            [{ 'size': [] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'direction': 'rtl' }],
            ['link', 'image', 'video', 'formula'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['clean']
          ],
          handlers: {
            image: imageHandler,
          },
        },
      }), [imageHandler]);

    const onSubmit = async (values: ContentFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/marketing/content/${contentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(values),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to update content.');
            toast({ title: "Content Updated", description: "Your changes have been saved." });
            router.push('/dashboard/marketing/content');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleRebuild = async () => {
      if (!user || !dataOwnerId) return;
      if (!rebuildPrompt.trim()) {
          toast({ title: "Prompt Required", description: "Please provide instructions for the AI.", variant: "destructive" });
          return;
      }
      setIsRebuilding(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/marketing/content/${contentId}/regenerate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ prompt: rebuildPrompt, userId: dataOwnerId })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to rebuild content.');
        
        const newContent = await response.json();
        form.reset({
          contentName: newContent.contentName,
          subject: newContent.subject,
          htmlContent: newContent.htmlContent,
        });
        toast({ title: "Content Rebuilt", description: "The AI has generated a new version of your content."});
      } catch(e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
          setIsRebuilding(false);
      }
    }


    if (isLoading || authLoading) {
        return <MailingListLoading />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Edit Marketing Content</h1>
                    <p className="text-muted-foreground">Modify the subject and body of your email content.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/marketing/content">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Content List
                    </Link>
                </Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Content Editor</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField control={form.control} name="contentName" render={({ field }) => (<FormItem><FormLabel>Content Name*</FormLabel><FormControl><Input placeholder="e.g., Q3 Promo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Email Subject*</FormLabel><FormControl><Input placeholder="A special offer just for you!" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="htmlContent" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Body (HTML)*</FormLabel>
                                            <FormControl>
                                                <ReactQuill 
                                                    forwardedRef={quillRef}
                                                    theme="snow" 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    className="bg-white"
                                                    modules={modules}
                                                />
                                            </FormControl>
                                            <FormDescription>Use {'{{MEMBER_NAME}}'} for names. Use standard HTML tags.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle>AI Actions</CardTitle></CardHeader>
                                <CardContent>
                                <Textarea placeholder="Instructions for AI (e.g., 'Make it more formal', 'Add a section about our new warranty')..." value={rebuildPrompt} onChange={e => setRebuildPrompt(e.target.value)} />
                                </CardContent>
                                <CardFooter>
                                    <Button type="button" onClick={handleRebuild} disabled={isRebuilding}>
                                    {isRebuilding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Rebuilding...</> : <><RefreshCw className="mr-2 h-4 w-4"/>Rebuild with AI</>}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                        <Card className="lg:sticky lg:top-20">
                            <CardHeader>
                                <CardTitle>Live Preview</CardTitle>
                                <CardDescription>This is an approximation of how the email will look.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md p-4 bg-gray-50 min-h-[500px]">
                                    <h3 className="text-lg font-semibold mb-4">{form.watch('subject')}</h3>
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: form.watch('htmlContent') || '' }}></div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
