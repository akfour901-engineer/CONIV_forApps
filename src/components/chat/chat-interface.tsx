'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { WorkOrder, ChatMessage } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Loader2, ArrowLeft, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ChatInterfaceProps {
  workOrder: WorkOrder;
  onBack?: () => void;
}

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function ChatInterface({ workOrder, onBack }: ChatInterfaceProps) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    setIsLoadingHistory(true);
    
    const fetchMessages = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/chat?workOrderId=${workOrder.id}`, {
          headers: { 'Authorization': `Bearer ${idToken}` },
        });
        if (!response.ok) throw new Error('Failed to fetch messages.');
        const data: ChatMessage[] = await response.json();
        setMessages(data);
      } catch (error: any) {
        toast({ title: 'Error', description: `Could not load messages: ${error.message}`, variant: 'destructive' });
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchMessages();
  }, [workOrder.id, user, toast]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !user) return;

    setIsSending(true);
    let imageUrl = '';
    let fileName = null;
    let fileType = null;
    
    try {
        if (selectedFile) {
            const reader = new FileReader();
            imageUrl = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
            });
            fileName = selectedFile.name;
            fileType = selectedFile.type;
        }

        const idToken = await user.getIdToken();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ 
                workOrderId: workOrder.id, 
                text: newMessage,
                imageUrl,
                fileName,
                fileType
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to send message.');

        setMessages(prev => [...prev, result]);
        setNewMessage('');
        setSelectedFile(null);
        setImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";

    } catch (error: any) {
        toast({ title: 'Error', description: `Could not send message: ${error.message}`, variant: 'destructive' });
    } finally {
        setIsSending(false);
    }
  };
  
  const getInitials = (name: string) => (name.split(' ').map(n => n[0]).join('') || '?').toUpperCase();
  
  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <header className="flex items-center gap-4 border-b p-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h2 className="text-lg font-semibold truncate">{workOrder.workOrderNumber} - {workOrder.organizationName}</h2>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex items-end gap-2", msg.userId === user?.uid ? "justify-end" : "justify-start")}>
                {msg.userId !== user?.uid && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2 space-y-2", msg.userId === user?.uid ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  <p className="font-semibold text-xs">{msg.senderName}</p>
                  {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                  {msg.imageUrl && msg.fileType?.startsWith('image/') && (
                    <div className="relative aspect-square max-w-[200px] overflow-hidden rounded-md mt-2">
                       <Image src={msg.imageUrl} alt={msg.fileName || 'Uploaded image'} layout="fill" objectFit="cover" />
                    </div>
                  )}
                   {msg.imageUrl && !msg.fileType?.startsWith('image/') && (
                      <a href={msg.imageUrl} download={msg.fileName} className="flex items-center gap-2 p-2 bg-background/50 rounded-md hover:bg-background/70">
                         <FileIcon className="h-5 w-5"/>
                         <span className="text-sm font-medium truncate">{msg.fileName}</span>
                      </a>
                  )}
                  <p className="text-xs opacity-70 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                 {msg.userId === user?.uid && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {(imagePreview || selectedFile) && (
        <div className="p-2 border-t">
          {imagePreview ? (
            <div className="relative w-20 h-20">
              <Image src={imagePreview} alt="Preview" layout="fill" objectFit="cover" className="rounded-md" />
            </div>
          ) : (
             <div className="flex items-center gap-2 p-2 bg-secondary rounded-md">
                <FileIcon className="h-5 w-5"/>
                <span className="text-sm font-medium truncate">{selectedFile?.name}</span>
             </div>
          )}
        </div>
      )}

      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" id="chat-file-upload"/>
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }}
          />
          <Button onClick={handleSendMessage} disabled={isSending}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
