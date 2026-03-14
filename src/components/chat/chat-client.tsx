
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { WorkOrder, ChatMessage, WorkOrderWithLatestMessage } from '@/types/server-only';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Paperclip, Send, Loader2, ArrowLeft, X, FileText, MessageSquare, PanelLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Image from 'next/image';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

// Extracted WorkOrderList component for reusability
const WorkOrderList = ({ workOrders, selectedWorkOrder, onSelect, isLoading }: {
  workOrders: WorkOrderWithLatestMessage[],
  selectedWorkOrder: WorkOrderWithLatestMessage | null,
  onSelect: (wo: WorkOrderWithLatestMessage) => void,
  isLoading: boolean
}) => {
  const formatLastMessageTime = (timestamp: string) => {
    const date = parseISO(timestamp);
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yy');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Projects</h2>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : workOrders.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No work orders found.</div>
        ) : (
          <div className="divide-y">
            {workOrders.map((wo) => (
              <button
                key={wo.id}
                className={cn(
                  "w-full text-left p-4 hover:bg-accent transition-colors",
                  selectedWorkOrder?.id === wo.id && "bg-secondary"
                )}
                onClick={() => onSelect(wo)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold truncate">{wo.workOrderNumber}</h3>
                  {wo.latestMessage && (
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatLastMessageTime(wo.latestMessage.timestamp)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{wo.organizationName}</p>
                {wo.latestMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {wo.latestMessage.text || 'Image'}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};


export default function ChatClientPage() {
  const { user, userProfile, dataOwnerId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrderWithLatestMessage[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderWithLatestMessage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorkOrders = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/chat/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error('Failed to fetch projects.');
      const data: WorkOrderWithLatestMessage[] = await response.json();
      setWorkOrders(data);
      if (data.length > 0 && !selectedWorkOrder) {
        // Automatically select the first one if none is selected
        // setSelectedWorkOrder(data[0]); 
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast, selectedWorkOrder]);

  useEffect(() => {
    if (!authLoading) {
      fetchWorkOrders();
    }
  }, [authLoading, fetchWorkOrders]);

  useEffect(() => {
    if (selectedWorkOrder) {
      const fetchMessages = async () => {
        setIsLoading(true);
        try {
          if (!user) throw new Error("User not authenticated.");
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/chat?workOrderId=${selectedWorkOrder.id}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
          if (!response.ok) throw new Error("Failed to fetch messages.");
          setMessages(await response.json());
        } catch (error: any) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedWorkOrder, user, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectWorkOrder = (wo: WorkOrderWithLatestMessage) => {
    setSelectedWorkOrder(wo);
    setIsMobileSheetOpen(false); // Close sheet on mobile after selection
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedWorkOrder || !user || !userProfile) return;
    
    setIsSending(true);
    const tempId = `temp_${Date.now()}`;
    let attachmentData: string | undefined = undefined;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      userId: user.uid,
      senderName: userProfile.fullName || userProfile.email || 'You',
      workOrderId: selectedWorkOrder.id!,
      text: newMessage,
      timestamp: new Date().toISOString(),
      imageUrl: attachment ? URL.createObjectURL(attachment) : undefined,
      fileName: attachment?.name,
      fileType: attachment?.type,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setAttachment(null);
    if(fileInputRef.current) fileInputRef.current.value = "";

    try {
      if (attachment) {
        attachmentData = await fileToBase64(attachment);
      }

      const idToken = await user.getIdToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          workOrderId: selectedWorkOrder.id,
          text: newMessage,
          imageUrl: attachmentData,
          fileName: attachment?.name,
          fileType: attachment?.type,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || "Failed to send message.");
      }
      
      const savedMessage = await response.json();
      setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
      
    } catch (error: any) {
      console.error("Message send error:", error);
      toast({ title: "Send Error", description: error.message, variant: "destructive" });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, error: true } : m));
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: 'File too large', description: `Maximum size is ${MAX_FILE_SIZE_MB}MB.`, variant: 'destructive' });
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast({ title: 'Invalid file type', description: 'Only images and PDFs are allowed.', variant: 'destructive' });
        return;
      }
      setAttachment(file);
    }
  };
  
  if (authLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex h-full border rounded-lg overflow-hidden shadow-sm">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-full max-w-xs border-r h-full">
        <WorkOrderList
          workOrders={workOrders}
          selectedWorkOrder={selectedWorkOrder}
          onSelect={handleSelectWorkOrder}
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full">
        {selectedWorkOrder ? (
          <>
            <div className="flex items-center p-3 border-b shrink-0">
              <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden mr-2">
                    <PanelLeft className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85%]">
                  <WorkOrderList
                    workOrders={workOrders}
                    selectedWorkOrder={selectedWorkOrder}
                    onSelect={handleSelectWorkOrder}
                    isLoading={isLoading}
                  />
                </SheetContent>
              </Sheet>

              <div className="flex-1">
                <h2 className="font-semibold text-lg">{selectedWorkOrder.workOrderNumber}</h2>
                <p className="text-sm text-muted-foreground">{selectedWorkOrder.organizationName}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex items-end gap-2", msg.userId === user?.uid ? "justify-end" : "justify-start")}>
                    {msg.userId !== user?.uid && (
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{msg.senderName?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                    )}
                    <div className={cn("max-w-md rounded-lg p-3 text-sm", msg.userId === user?.uid ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                       <p className="font-bold mb-1 text-xs">{msg.senderName}</p>
                       {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                       {msg.imageUrl && msg.fileType?.startsWith('image/') && <Image src={msg.imageUrl} alt={msg.fileName || "attachment"} width={200} height={200} className="rounded-md mt-2" data-ai-hint="chat image"/>}
                       {msg.imageUrl && msg.fileType === 'application/pdf' && <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 underline"><FileText className="h-4 w-4" />{msg.fileName || 'View PDF'}</a>}
                       {msg.error && <p className="text-xs text-red-300 mt-1">Failed to send</p>}
                    </div>
                     {msg.userId === user?.uid && (
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{msg.senderName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t shrink-0 bg-background">
              {attachment && (
                <div className="mb-2 p-2 border rounded-md flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{attachment.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                  placeholder="Type a message..."
                  disabled={isSending}
                />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
                  <Paperclip className="h-5 w-5" />
                  <Input type="file" ref={fileInputRef} onChange={handleAttachment} className="hidden" accept={ALLOWED_MIME_TYPES.join(',')} />
                </Button>
                <Button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !attachment)}>
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
            <MessageSquare className="h-12 w-12 mb-4"/>
            <h2 className="text-xl font-semibold">Select a Project</h2>
            <p>Choose a project from the list to start chatting.</p>
             <div className="md:hidden mt-4">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline"><PanelLeft className="mr-2 h-4 w-4"/>Show Projects</Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[85%]">
                        <WorkOrderList workOrders={workOrders} selectedWorkOrder={null} onSelect={handleSelectWorkOrder} isLoading={isLoading} />
                    </SheetContent>
                </Sheet>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
