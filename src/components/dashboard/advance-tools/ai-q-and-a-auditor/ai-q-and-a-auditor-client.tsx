
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, HelpCircle, AlertTriangle, Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { marked } from 'marked';
import AiQAndAAuditorLoading from './loading';

interface QAndAOutput {
  answer: string;
  newResourcePoints?: number;
  error?: string;
}

export default function AiQAndAAuditorClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isThinking, setIsThinking] = useState(false);
    const [query, setQuery] = useState('');
    const [conversation, setConversation] = useState<{ query: string; answer: string; }[]>([]);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canRunAudits;

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [conversation]);
    
    const handleAskQuestion = async () => {
        if (!query.trim()) return;
        if (!user || !userProfile || !dataOwnerId) return;

        const currentQuery = query;
        setQuery('');
        setIsThinking(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/q-and-a-auditor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, query: currentQuery }),
            });
            const result: QAndAOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get an answer.');
            
            setConversation(prev => [...prev, { query: currentQuery, answer: result.answer }]);

            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsThinking(false);
        }
    };
    
    if(authLoading) return <AiQAndAAuditorLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
                 <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
            </div>
        );
    }
  
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><HelpCircle className="mr-3 h-7 w-7 text-primary" />AI Q&A Auditor</h1>
                    <p className="text-muted-foreground">Ask questions about your business data in natural language.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card className="flex-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Chat with Your Data</CardTitle>
                    <CardDescription>Ask questions like `What was my total revenue last month?`` or `List all overdue invoices`.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-2">
                    <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                        <div className="space-y-6">
                            {conversation.map((entry, index) => (
                                <React.Fragment key={index}>
                                    <div className="flex justify-end items-start gap-3">
                                        <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-lg">
                                            <p>{entry.query}</p>
                                        </div>
                                        <Avatar className="h-8 w-8"><AvatarFallback>{userProfile?.fullName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                                    </div>
                                    <div className="flex justify-start items-start gap-3">
                                        <Avatar className="h-8 w-8 bg-secondary"><AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback></Avatar>
                                        <div className="bg-secondary p-3 rounded-lg max-w-lg prose prose-sm" dangerouslySetInnerHTML={{ __html: marked.parse(entry.answer) as string }}></div>
                                    </div>
                                </React.Fragment>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start items-start gap-3">
                                    <Avatar className="h-8 w-8 bg-secondary"><AvatarFallback><Loader2 className="h-5 w-5 animate-spin"/></AvatarFallback></Avatar>
                                    <div className="bg-secondary p-3 rounded-lg max-w-lg">
                                        <p className="text-sm italic text-muted-foreground">Thinking...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="border-t p-4">
                    <div className="flex w-full items-center space-x-2">
                        <Input
                            placeholder="Ask a question about your data..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isThinking && handleAskQuestion()}
                            disabled={isThinking}
                        />
                        <Button onClick={handleAskQuestion} disabled={isThinking || !query.trim()}>
                            {isThinking ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
