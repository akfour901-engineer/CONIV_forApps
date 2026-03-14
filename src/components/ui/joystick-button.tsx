
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { RefreshCw } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';
import Draggable, { type DraggableEvent, type DraggableData } from 'react-draggable';

const MemoizedDraggable = React.memo(Draggable);

export function JoystickButton() {
  const { setIsLoading } = useLoading();
  const [isClient, setIsClient] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDragStart = (e: DraggableEvent, data: DraggableData) => {
    hasDraggedRef.current = false;
  };
  
  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    hasDraggedRef.current = true;
  };

  const handleStop = () => {
    if (!hasDraggedRef.current) {
        // This was a click, not a drag.
        window.location.reload();
    }
    // Reset for the next interaction.
    hasDraggedRef.current = false;
  };

  if (!isClient) {
    return null;
  }

  return (
    <MemoizedDraggable
        onStart={handleDragStart}
        onDrag={handleDrag}
        onStop={handleStop}
    >
        <div className="fixed bottom-16 right-4 md:bottom-4 z-[100] cursor-grab active:cursor-grabbing">
            <Button
                variant="default"
                size="icon"
                className="h-14 w-14 rounded-full shadow-2xl animate-pulse"
                aria-label="Refresh Page"
            >
                <RefreshCw className="h-7 w-7" />
            </Button>
        </div>
    </MemoizedDraggable>
  );
}
