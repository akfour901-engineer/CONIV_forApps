// src/components/workflow/workflow-graph.tsx
'use client';

import React from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Simple default nodes (no custom types needed)
const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: '1. Setup Your Business' },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    data: { label: '2. Define Resources' },
    position: { x: 300, y: 0 },
  },
  {
    id: '3',
    data: { label: '3. Create Estimates' },
    position: { x: 600, y: 0 },
  },
  {
    id: '4',
    data: { label: '4. Manage Work Orders' },
    position: { x: 300, y: 200 },
  },
  {
    id: '5',
    data: { label: '5. Handle Project Execution' },
    position: { x: 300, y: 400 },
  },
  {
    id: '6',
    data: { label: '6. Issue & Manage Invoices' },
    position: { x: 600, y: 400 },
  },
  {
    id: '7',
    data: { label: '7. Analyze & Audit' },
    position: { x: 0, y: 400 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e2-4', source: '2', target: '4', animated: true },
  { id: 'e4-5', source: '4', target: '5', animated: true },
  { id: 'e5-6', source: '5', target: '6', animated: true },
  { id: 'e5-7', source: '5', target: '7', animated: true },
];

function Flow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ height: '700px', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1.5} />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export function WorkflowGraph() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}