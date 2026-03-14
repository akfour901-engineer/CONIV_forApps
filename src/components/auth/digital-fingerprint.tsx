
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DigitalFingerprintProps {
  phrase1?: string | null;
  phrase2?: string | null;
  enabled: boolean;
}

// Simple hash function to create a number from a string.
// This is NOT for security, only for creating a deterministic visual pattern.
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const DigitalFingerprint: React.FC<DigitalFingerprintProps> = ({
  phrase1,
  phrase2,
  enabled,
}) => {
  if (!enabled || (!phrase1 && !phrase2)) {
    return null;
  }

  const combinedString = `${phrase1 || ''}-${phrase2 || ''}`;
  const hash = simpleHash(combinedString);

  // Generate a 5x5 grid of dots. The color is determined by the hash bits.
  const dots = Array.from({ length: 25 }, (_, i) => {
    // Use different bits for color and opacity to create more variation
    const colorBit = (hash >> (i % 32)) & 1;
    const opacityBit = (hash >> ((i + 16) % 32)) & 1;
    
    const color = colorBit ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))';
    const opacity = opacityBit ? 'opacity-30' : 'opacity-10';

    return (
      <div
        key={i}
        className={cn("w-1 h-1 rounded-full", opacity)}
        style={{ backgroundColor: color }}
      />
    );
  });

  return (
    <div
      className="absolute inset-0 flex items-center justify-center opacity-70"
      aria-hidden="true"
    >
      <div className="grid grid-cols-5 gap-1.5">{dots}</div>
    </div>
  );
};
