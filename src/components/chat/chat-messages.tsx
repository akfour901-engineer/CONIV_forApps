
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ChatMessage } from '@/types';
import React, { useEffect, useRef } from 'react';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  currentUserId?: string;
}

export function ChatMessages({ messages, isLoading, currentUserId }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4" ref={scrollAreaRef}>
      {messages.map((message, index) => {
        const isSender = message.userId === currentUserId;
        return (
          <div
            key={message.id || index}
            className={cn(
              "flex items-start gap-3",
              isSender ? "justify-end" : "justify-start"
            )}
          >
            {!isSender && (
              <Avatar className="h-8 w-8">
                <AvatarFallback>{message.senderName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg",
                isSender
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              )}
            >
              {!isSender && <p className="text-xs font-semibold mb-1">{message.senderName}</p>}
              {message.text && <p className="text-sm whitespace-pre-wrap">{message.text}</p>}
              {message.imageUrl && <img src={message.imageUrl} alt="Uploaded content" className="mt-2 rounded-md max-w-full h-auto" />}
              <p className="text-xs mt-1 opacity-70 text-right">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {isSender && (
              <Avatar className="h-8 w-8">
                <AvatarFallback>{message.senderName?.charAt(0) || 'Me'}</AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      })}
    </div>
  );
}

