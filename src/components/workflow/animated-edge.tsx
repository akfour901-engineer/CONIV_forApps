
'use client';

import React from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2, stroke: 'hsl(var(--primary))' }} />
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        style={{
            filter: 'drop-shadow(0 0 2px hsl(var(--primary)))',
            strokeDasharray: '5 5',
            animation: 'dashdraw 0.5s linear infinite',
        }}
      />
      <style jsx global>{`
        @keyframes dashdraw {
          from {
            stroke-dashoffset: 10;
          }
        }
      `}</style>
    </>
  );
}
