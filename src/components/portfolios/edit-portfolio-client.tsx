
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { GeneratePortfolioInput, GeneratePortfolioOutput, Company, Portfolio } from '@/types';
import { ArrowLeft, Bot, Loader2, Workflow, AlertTriangle, Check, X, PlusCircle, Trash2, Eye, Code, RefreshCw, Move, GripVertical, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import EditPortfolioLoadingSkeleton from '@/app/dashboard/portfolios/[portfolioId]/edit/loading';
import { sectionTemplates, type SectionTemplate } from './section-templates';
import { AddSectionModal } from './add-section-modal';
import 'react-quill/dist/quill.snow.css';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false, loading: () => <p>Loading editor...</p> });

const portfolioFormSchema = z.object({
  portfolioName: z.string().min(3, "Name must be at least 3 characters.").optional(),
  themeColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color.").optional(),
});

type PortfolioFormValues = z.infer<typeof portfolioFormSchema>;

interface Section {
  id: string;
  html: string;
  title: string;
}

export default function EditPortfolioClientPage({ portfolioId }: { portfolioId: string }) {
  const { user, dataOwnerId, loading: authLoading, userProfile, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);

  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'html' | 'visual'>('html');

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildPrompt, setRebuildPrompt] = useState('');
  const initialFetchDone = useRef(false);
  const ignoreInitialChange = useRef(true);

  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
  });

  const parseAndSetSections = useCallback((htmlContent: string) => {
    console.log("--- 1. PARSING SECTIONS ON LOAD ---");
    console.log("Raw HTML received:", htmlContent.substring(0, 200) + "...");

    if (typeof window === 'undefined' || !htmlContent) {
        setSections([]);
        console.log("Result: No content or not in browser, sections set to empty array.");
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent.trim(), 'text/html');
    
    // Correct, more robust selector
    const topLevelElements = doc.querySelectorAll('body > *');

    const parsedSections: Section[] = Array.from(topLevelElements)
        .map((element, index) => {
            let outerHtml = element.outerHTML;
            // **RE-WRAP LOGIC**: If a chunk of HTML lost its wrapper, put it back in a generic <section>
            if (!['HEADER', 'SECTION', 'FOOTER'].includes(element.tagName)) {
                console.warn(`Section ${index} was unwrapped. Re-wrapping in a <section> tag.`);
                outerHtml = `<section id="recovered-section-${index}-${Date.now()}" data-section-title="Recovered Section">${outerHtml}</section>`;
            }
            return {
                id: element.id || `section-${index}-${Date.now()}`,
                title: element.getAttribute('data-section-title') || `Section ${index + 1}`,
                html: outerHtml,
            };
        });
    
    console.log(`Result: Parsed ${parsedSections.length} sections.`, parsedSections.map(s => s.title));
    setSections(parsedSections);
    
    if (parsedSections.length > 0 && activeSectionIndex === null) {
      setActiveSectionIndex(0);
    }
  }, [activeSectionIndex]);
  
  const fetchPortfolio = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch portfolio data.');
      const data: Portfolio = await response.json();

      if (data.userId !== dataOwnerId) {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/dashboard/portfolios');
          return;
      }
      form.reset({ portfolioName: data.portfolioName, themeColor: data.themeColor });
      parseAndSetSections(data.content);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, portfolioId, form, toast, router, parseAndSetSections]);


  useEffect(() => {
    if (user && dataOwnerId && !initialFetchDone.current) {
        fetchPortfolio();
        initialFetchDone.current = true;
    }
  }, [user, dataOwnerId, fetchPortfolio]);

  const handleAddSection = (template: SectionTemplate) => {
    const newSection: Section = {
      id: `${template.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      html: template.html,
      title: template.name,
    };
    
    setSections(currentSections => {
      const updatedSections = [...currentSections, newSection];
      setActiveSectionIndex(updatedSections.length - 1);
      return updatedSections;
    });

    setIsAddSectionModalOpen(false);
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragItem.current = index;
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragOverItem.current = index;
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        setSections(prevSections => {
            const newSections = [...prevSections];
            const draggedItemContent = newSections.splice(dragItem.current!, 1)[0];
            newSections.splice(dragOverItem.current!, 0, draggedItemContent);
            
            if (activeSectionIndex === dragItem.current) {
              setActiveSectionIndex(dragOverItem.current);
            } else if (activeSectionIndex !== null && dragItem.current !== null && dragOverItem.current !== null) {
               if (dragItem.current < activeSectionIndex && dragOverItem.current >= activeSectionIndex) {
                 setActiveSectionIndex(activeSectionIndex - 1);
               } else if (dragItem.current > activeSectionIndex && dragOverItem.current <= activeSectionIndex) {
                 setActiveSectionIndex(activeSectionIndex + 1);
               }
            }

            return newSections;
        });
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDeleteSection = (index: number) => {
    setSections(prevSections => {
      const newSections = prevSections.filter((_, i) => i !== index);
      if (activeSectionIndex === index) {
        setActiveSectionIndex(newSections.length > 0 ? Math.max(0, index - 1) : null);
      } else if (activeSectionIndex !== null && activeSectionIndex > index) {
        setActiveSectionIndex(activeSectionIndex - 1);
      }
      return newSections;
    });
  };

  const reassembleHtml = () => sections.map(s => s.html.trim()).join('\n').trim();
  
  const handleEditorContentChange = (content: string) => {
    if (ignoreInitialChange.current) {
      return; 
    }
    if (activeSectionIndex !== null) {
      setSections(prev => 
        prev.map((sec, i) => i === activeSectionIndex ? { ...sec, html: content } : sec)
      );
    }
  };

  useEffect(() => {
    ignoreInitialChange.current = true;
    const timer = setTimeout(() => {
        if(ignoreInitialChange.current) {
            ignoreInitialChange.current = false;
        }
    }, 500); 
    return () => clearTimeout(timer);
  }, [activeSectionIndex]);


  const onSubmit = async (values: PortfolioFormValues) => {
    if (!user || !portfolioId) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const finalHtml = reassembleHtml();
      
      console.log("--- 2. SAVING PORTFOLIO ---");
      console.log("Final HTML being sent to server:", finalHtml);

      const finalValues = {
          portfolioName: values.portfolioName,
          themeColor: values.themeColor,
          content: finalHtml,
      };

      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(finalValues),
      });
      if (!response.ok) throw new Error('Failed to update portfolio.');
      toast({ title: "Success", description: "Portfolio updated successfully." });
      router.push('/dashboard/portfolios');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRebuild = async () => {
    if (!user || !userProfile || !dataOwnerId || !portfolioId) return;

    const confirmRebuild = window.confirm("Are you sure you want to rebuild this portfolio with AI? All current content and customizations will be replaced.");
    if (!confirmRebuild) return;

    setRebuilding(true);
    try {
        const idToken = await user.getIdToken();
        const portfolioResponse = await fetch(`/api/portfolios/${portfolioId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!portfolioResponse.ok) throw new Error("Could not fetch original portfolio data to rebuild.");
        
        const originalPortfolio: Portfolio = await portfolioResponse.json();

        const rebuildPayload: GeneratePortfolioInput = {
            userId: dataOwnerId,
            portfolioType: 'allCompanies', // Rebuild always uses latest data
            prompt: rebuildPrompt || 'Rebuild the existing portfolio with an updated design and my latest data.',
            publicId: originalPortfolio.publicId,
            portfolioId: portfolioId 
        };

        const response = await fetch('/api/ai/generate-portfolio-flow', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}` 
            },
            body: JSON.stringify(rebuildPayload),
        });

        const result: GeneratePortfolioOutput = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to rebuild portfolio.');
        
        if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid && userProfile) {
            updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
        }
        
        toast({ title: "Rebuild Complete!", description: "Your portfolio has been rebuilt with a fresh design." });
        router.push('/dashboard/portfolios');
    } catch (error: any) {
        toast({ title: "Rebuild Failed", description: error.message, variant: "destructive" });
    } finally {
        setRebuilding(false);
    }
  };
  
  const handleTabChange = (newTab: string) => {
    if (newTab === 'visual' && activeSectionIndex !== null) {
      const currentHtml = sections[activeSectionIndex].html;
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml.trim(), 'text/html');
      const bodyContent = doc.body.innerHTML;
      setSections(prev => 
        prev.map((sec, i) => i === activeSectionIndex ? { ...sec, html: bodyContent } : sec)
      );
    }
    setActiveEditorTab(newTab as 'visual' | 'html');
  };

  if (isLoading || authLoading) return <EditPortfolioLoadingSkeleton />;

  return (
    <>
      <AddSectionModal 
        isOpen={isAddSectionModalOpen}
        onOpenChange={setIsAddSectionModalOpen}
        onSectionSelect={handleAddSection}
        sectionTemplates={sectionTemplates}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Editing: {form.watch('portfolioName')}</h1>
          <Button variant="outline" asChild><Link href="/dashboard/portfolios"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Link></Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-3 space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                  <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="portfolioName" render={({ field }) => (<FormItem><FormLabel>Portfolio Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="themeColor" render={({ field }) => (<FormItem><FormLabel>Theme Color</FormLabel><FormControl><Input type="color" {...field} className="h-10"/></FormControl><FormMessage /></FormItem>)}/>
                  </CardContent>
                  <CardFooter><Button type="submit" disabled={isSubmitting || rebuilding} className="w-full">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save Changes</>}</Button></CardFooter>
                </Card>
              </form>
            </Form>
            
            <Card>
              <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center"><Move className="mr-2 h-4 w-4"/>Manage Sections</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setIsAddSectionModalOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>
                  </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {sections.map((section, index) => (
                    <div 
                      key={section.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, index)} 
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      className={`p-2 border my-1 cursor-grab active:cursor-grabbing flex items-center gap-2 rounded-md ${activeSectionIndex === index ? 'bg-secondary ring-2 ring-primary' : 'bg-background'}`}
                      onClick={() => setActiveSectionIndex(index)}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm truncate flex-1"><strong>{index + 1}:</strong> {section.title}</div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => {e.stopPropagation(); handleDeleteSection(index)}}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
             <Card>
                <CardHeader><CardTitle className="text-base">AI Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                     <Textarea placeholder="Optional: Provide instructions for the rebuild (e.g., 'Make it more minimalist')." value={rebuildPrompt} onChange={(e) => setRebuildPrompt(e.target.value)} rows={3} />
                     <Button onClick={handleRebuild} disabled={rebuilding || isSubmitting} className="w-full">
                        {rebuilding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Rebuilding...</> : <><RefreshCw className="mr-2 h-4 w-4"/>Rebuild with AI</>}
                    </Button>
                </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-9">
              <Tabs value={activeEditorTab} onValueChange={handleTabChange} className="w-full">
                <div className="flex justify-between items-center mb-2">
                    <Select onValueChange={(val) => setActiveSectionIndex(Number(val))} value={activeSectionIndex !== null ? String(activeSectionIndex) : undefined}>
                        <SelectTrigger className="w-auto"><SelectValue placeholder="Select a section to edit..." /></SelectTrigger>
                        <SelectContent>
                            {sections.map((section, index) => (
                                <SelectItem key={section.id} value={String(index)}>
                                    {index + 1}: {section.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <TabsList>
                      <TabsTrigger value="html"><Code className="mr-2 h-4 w-4" />HTML</TabsTrigger>
                      <TabsTrigger value="visual"><Eye className="mr-2 h-4 w-4" />Visual</TabsTrigger>
                    </TabsList>
                </div>
                {activeSectionIndex !== null && sections[activeSectionIndex] ? (
                  <>
                  <TabsContent value="visual">
                    <ReactQuill 
                      key={`${activeSectionIndex}-visual`}
                      theme="snow"
                      value={sections[activeSectionIndex]?.html || ''}
                      onChange={handleEditorContentChange}
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          ['link', 'image'],
                          [{ 'color': [] }, { 'background': [] }],
                          ['clean']
                        ]
                      }}
                      className="bg-white"
                    />
                  </TabsContent>
                  <TabsContent value="html">
                     <Textarea
                        key={`${activeSectionIndex}-html`}
                        value={sections[activeSectionIndex]?.html || ''}
                        onChange={(e) => handleEditorContentChange(e.target.value)}
                        className="font-mono h-[400px]"
                      />
                  </TabsContent>
                  </>
                ) : (
                  <Card className="min-h-[400px] flex items-center justify-center">
                    <CardContent>
                      <p className="text-muted-foreground">Select a section to edit or add a new one.</p>
                    </CardContent>
                  </Card>
                )}
              </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}
