'use client';

import React, { useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: '1. Setup Business' },
    position: { x: 0, y: 150 },
  },
  {
    id: '2',
    data: { label: '2. Define Resources' },
    position: { x: 300, y: 150 },
  },
  {
    id: '3',
    data: { label: '3. Create Estimates' },
    position: { x: 600, y: 0 },
  },
  {
    id: '4',
    data: { label: '4. Manage Work Orders' },
    position: { x: 600, y: 300 },
    style: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'white',
      width: 180,
      height: 80,
      textAlign: 'center' as const,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
  },
  {
    id: '5',
    data: { label: '5. Handle Project Execution' },
    position: { x: 900, y: 300 },
  },
  {
    id: '6',
    data: { label: '6. Issue & Manage Invoices' },
    position: { x: 600, y: 600 },
  },
  {
    id: '7',
    data: { label: '7. Analyze & Audit' },
    position: { x: 300, y: 500 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true, label: 'provides foundation' },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', animated: true, label: 'for' },
  { id: 'e3-4', source: '3', target: '4', type: 'smoothstep', animated: true, label: 'converts to' },
  { id: 'e2-4', source: '2', target: '4', type: 'smoothstep', animated: true, label: 'for direct creation' },
  { id: 'e4-5', source: '4', target: '5', type: 'smoothstep', animated: true, label: 'leads to' },
  { id: 'e5-6', source: '5', target: '6', type: 'smoothstep', animated: true, label: 'results in' },
  { id: 'e4-6', source: '4', target: '6', type: 'smoothstep', animated: true, label: 'for billing' },
  { id: 'e5-7', source: '5', target: '7', type: 'smoothstep', animated: true, label: 'provides data for' },
  { id: 'e4-7', source: '4', target: '7', type: 'smoothstep', animated: true, label: 'provides data for' },
];

function Flow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ height: '700px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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