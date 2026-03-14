'use client';

import React from 'react';
import type { ChatMessage, WorkOrder } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export interface WorkOrderWithLatestMessage extends WorkOrder {
  latestMessage: ChatMessage | null;
}

interface ChatListProps {
  workOrders: WorkOrderWithLatestMessage[];
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (workOrder: WorkOrderWithLatestMessage) => void;
  isLoading: boolean;
}

const ChatListItem = ({ workOrder, isSelected, onSelect }: { workOrder: WorkOrderWithLatestMessage; isSelected: boolean; onSelect: () => void; }) => {
  const { organizationName, workOrderNumber, latestMessage } = workOrder;

  const truncateText = (text: string, length: number) => {
    return text.length > length ? text.substring(0, length) + '...' : text;
  };
  
  const relativeTime = latestMessage?.timestamp
    ? formatDistanceToNow(new Date(latestMessage.timestamp), { addSuffix: true })
    : formatDistanceToNow(new Date(workOrder.createdAt), { addSuffix: true });

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-4 p-2 rounded-lg w-full text-left transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-accent/50"
      )}
    >
      <Avatar className="h-10 w-10 border">
        <AvatarFallback>{organizationName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm truncate">{organizationName}</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate">{latestMessage ? `${latestMessage.senderName}: ${latestMessage.text || 'Image'}` : `WO #${workOrderNumber}`}</p>
      </div>
    </button>
  );
};

export function ChatList({ workOrders, selectedWorkOrderId, onSelectWorkOrder, isLoading }: ChatListProps) {
  if (isLoading) {
    return (
        <div className="p-2 space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
  }
  
  return (
    <div className="flex flex-col w-full md:w-1/3 border-r h-full">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Chats</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workOrders.length > 0 ? (
          workOrders.map((wo) => (
            <ChatListItem
              key={wo.id}
              workOrder={wo}
              isSelected={wo.id === selectedWorkOrderId}
              onSelect={() => onSelectWorkOrder(wo)}
            />
          ))
        ) : (
          <p className="p-4 text-center text-sm text-muted-foreground">No work orders with chat history.</p>
        )}
      </div>
    </div>
  );
}
