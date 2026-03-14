
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
    positionRef.current = { x: data.x, y: data.y };
  };

  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    const dx = Math.abs(data.x - positionRef.current.x);
    const dy = Math.abs(data.y - positionRef.current.y);
    if (dx > 5 || dy > 5) { // Threshold to consider it a drag
      hasDraggedRef.current = true;
    }
  };
  
  const handleClick = () => {
    if (hasDraggedRef.current) {
        // If it was a drag, reset the flag and do nothing.
        hasDraggedRef.current = false;
        return;
    }
    // If it wasn't a drag, it's a click.
    window.location.reload();
  };

  if (!isClient) {
    return null;
  }

  return (
    <MemoizedDraggable
        onStart={handleDragStart}
        onDrag={handleDrag}
    >
        <div className="fixed bottom-16 right-4 md:bottom-4 z-[100] cursor-grab active:cursor-grabbing">
            <Button
                variant="default"
                size="icon"
                className="h-14 w-14 rounded-full shadow-2xl animate-pulse"
                onClick={handleClick}
                aria-label="Refresh Page"
            >
                <RefreshCw className="h-7 w-7" />
            </Button>
        </div>
    </MemoizedDraggable>
  );
}
