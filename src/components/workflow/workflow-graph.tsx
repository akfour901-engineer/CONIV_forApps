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
  // ==================== CORE MAIN FLOW ====================
  {
    id: '1',
    type: 'input',
    data: { label: '1. Onboarding & Setup\nCreate Company Profile + Basic Settings' },
    position: { x: 0, y: 100 },
    style: { width: 200 },
  },
  {
    id: '2',
    data: { label: '2. Resource Management\nBank Accounts, Labour Register, Inventory, SOR Rates' },
    position: { x: 280, y: 100 },
    style: { width: 220 },
  },
  {
    id: '3',
    data: { label: '3. Create Estimates\nItems + AI Suggestions + Client Quotes' },
    position: { x: 620, y: 20 },
    style: { width: 200 },
  },
  {
    id: '4',
    data: { label: '4. Work Orders (Core)\nConvert Estimate → Live Project' },
    position: { x: 620, y: 200 },
    style: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'white',
      width: 220,
      height: 100,
      textAlign: 'center' as const,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '12px',
      fontWeight: 'bold',
    },
  },
  {
    id: '5',
    data: { label: '5. Project Execution\nDPR, SVR, Labour Attendance, Documents, Time Tracking' },
    position: { x: 980, y: 200 },
    style: { width: 230 },
  },
  {
    id: '6',
    data: { label: '6. Billing & Revenue\nCreate Invoices, Track Payments, SD/TD/LD' },
    position: { x: 620, y: 460 },
    style: { width: 200 },
  },
  {
    id: '7',
    data: { label: '7. Analysis & Insights\nFinancial Reports, AI Audits, Performance' },
    position: { x: 280, y: 460 },
    style: { width: 210 },
  },

  // ==================== SUPPORTING MODULES ====================
  {
    id: '8',
    data: { label: 'Team & Collaboration\nInvite Members + Role Permissions' },
    position: { x: 0, y: 340 },
    style: { width: 180, backgroundColor: '#f3f4f6' },
  },
  {
    id: '9',
    data: { label: 'Documents & Compliance\nUpload Files, Licenses, Track Expiry' },
    position: { x: 980, y: 40 },
    style: { width: 190, backgroundColor: '#f3f4f6' },
  },
  {
    id: '10',
    data: { label: 'AI Intelligence Hub\nEstimate Help, Risk, Labor, Cash Flow, Fraud, Daily Briefing' },
    position: { x: 1320, y: 160 },
    style: { width: 250, backgroundColor: '#fef3c7', fontWeight: '600' },
  },
  {
    id: '11',
    data: { label: 'Portfolio & Marketing\nDigital Business Card, Public Showcase, Lead Generation' },
    position: { x: 1320, y: 420 },
    style: { width: 220, backgroundColor: '#e0f2fe' },
  },
  {
    id: '12',
    data: { label: 'Expenses & Follow-ups\nRecord Costs, Client Reminders' },
    position: { x: 620, y: 680 },
    style: { width: 200 },
  },
  {
    id: '13',
    data: { label: 'Resource Points System\nEarn from Rewards • Spend on Features' },
    position: { x: 0, y: 620 },
    style: { width: 190, backgroundColor: '#ecfdf5' },
  },
  {
    id: '14',
    data: { label: 'Activity Log & Security\nTrack All Actions + Login Alerts' },
    position: { x: 280, y: 680 },
    style: { width: 180, backgroundColor: '#fef2f2' },
  },
  {
    id: '15',
    data: { label: 'Mailing List & Campaigns\nBulk Email Marketing to Clients' },
    position: { x: 1320, y: 580 },
    style: { width: 200, backgroundColor: '#f0fdf4' },
  },
];

const initialEdges = [
  // Core Flow
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true, label: '→ Build Foundation' },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', animated: true, label: '→ Create Quotes' },
  { id: 'e3-4', source: '3', target: '4', type: 'smoothstep', animated: true, label: '→ Convert to Project' },
  { id: 'e2-4', source: '2', target: '4', type: 'smoothstep', animated: true, label: '→ Direct WO' },
  { id: 'e4-5', source: '4', target: '5', type: 'smoothstep', animated: true, label: '→ Execute Work' },
  { id: 'e5-6', source: '5', target: '6', type: 'smoothstep', animated: true, label: '→ Generate Revenue' },
  { id: 'e4-6', source: '4', target: '6', type: 'smoothstep', animated: true, label: '→ Direct Billing' },
  { id: 'e5-7', source: '5', target: '7', type: 'smoothstep', animated: true, label: '→ Data for Insights' },
  { id: 'e6-7', source: '6', target: '7', type: 'smoothstep', animated: true, label: '→ Financial Analysis' },
  { id: 'e4-7', source: '4', target: '7', type: 'smoothstep', animated: true, label: '→ Progress Tracking' },

  // Supporting Connections
  { id: 'e1-8', source: '1', target: '8', type: 'smoothstep', animated: true, label: '→ Build Team' },
  { id: 'e2-9', source: '2', target: '9', type: 'smoothstep', animated: true, label: '→ Licenses & Docs' },
  { id: 'e5-9', source: '5', target: '9', type: 'smoothstep', animated: true, label: '→ Upload Documents' },
  { id: 'e3-10', source: '3', target: '10', type: 'smoothstep', animated: true, label: '→ AI Estimate Help' },
  { id: 'e4-10', source: '4', target: '10', type: 'smoothstep', animated: true, label: '→ AI Risk Analysis' },
  { id: 'e5-10', source: '5', target: '10', type: 'smoothstep', animated: true, label: '→ Labor & Progress AI' },
  { id: 'e7-10', source: '7', target: '10', type: 'smoothstep', animated: true, label: '→ Advanced AI Audits' },
  { id: 'e4-11', source: '4', target: '11', type: 'smoothstep', animated: true, label: '→ Showcase Projects' },
  { id: 'e5-11', source: '5', target: '11', type: 'smoothstep', animated: true, label: '→ Update Portfolio' },
  { id: 'e5-12', source: '5', target: '12', type: 'smoothstep', animated: true, label: '→ Record Expenses' },
  { id: 'e6-12', source: '6', target: '12', type: 'smoothstep', animated: true, label: '→ Payment Follow-ups' },
  { id: 'e7-13', source: '7', target: '13', type: 'smoothstep', animated: true, label: '→ Earn Points' },
  { id: 'e10-13', source: '10', target: '13', type: 'smoothstep', animated: true, label: '→ Spend on AI' },
  { id: 'e5-14', source: '5', target: '14', type: 'smoothstep', animated: true, label: '→ Log Activities' },
  { id: 'e1-14', source: '1', target: '14', type: 'smoothstep', animated: true, label: '→ Security Logs' },
  { id: 'e6-15', source: '6', target: '15', type: 'smoothstep', animated: true, label: '→ Client Campaigns' },
  { id: 'e11-15', source: '11', target: '15', type: 'smoothstep', animated: true, label: '→ Marketing Leads' },
];

function Flow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ height: '760px', width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.05 }}
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