
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2 } from 'lucide-react';

const chatInputSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty.'),
});
type ChatInputFormValues = z.infer<typeof chatInputSchema>;

interface ChatInputProps {
  workOrderId: string;
  onMessageSent: () => void;
}

export function ChatInput({ workOrderId, onMessageSent }: ChatInputProps) {
  const { user, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<ChatInputFormValues>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: { text: '' },
  });

  const onSubmit = async (values: ChatInputFormValues) => {
    if (!user || !dataOwnerId) return;

    setIsSending(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          workOrderId,
          text: values.text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message.');
      }
      form.reset();
      onMessageSent(); // Trigger refresh in parent component
    } catch (error: any) {
      toast({
        title: 'Error Sending Message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
      <Input
        {...form.register('text')}
        placeholder="Type a message..."
        autoComplete="off"
        disabled={isSending}
      />
      <Button type="submit" size="icon" disabled={isSending}>
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
