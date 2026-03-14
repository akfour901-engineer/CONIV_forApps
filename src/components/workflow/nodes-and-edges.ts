// src/components/workflow/nodes-and-edges.ts
import { Node, Edge } from 'reactflow';

export const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    data: { 
        label: '1. Setup & Config', 
        description: 'User, Companies, Banks, Clients, Team' 
    },
    position: { x: 0, y: 50 },
  },
  {
    id: '2',
    type: 'custom',
    data: { 
        label: '2. Resource Mgmt',
        description: 'SOR, Inventory, Labour, Subcontractors'
    },
    position: { x: 250, y: 50 },
  },
  {
    id: '3',
    type: 'custom',
    data: { 
        label: '3. Project Lifecycle',
        description: 'Estimates, Work Orders, Invoices'
    },
    position: { x: 500, y: 50 },
  },
  {
    id: '4',
    type: 'custom',
    data: { 
        label: '4. Compliance & Docs',
        description: 'DPR, SVR, Documents, Licenses'
    },
    position: { x: 750, y: 50 },
  },
  {
    id: '5',
    type: 'custom',
    data: {
        label: '5. Advanced Tools & AI',
        description: 'AI Tools, Gantt Charts, QR Cards'
    },
    position: { x: 250, y: 200 },
  },
  {
    id: '6',
    type: 'custom',
    data: {
        label: '6. Marketing & Community',
        description: 'Follow-ups, Mailing Lists, Marketplace'
    },
    position: { x: 500, y: 200 },
  },
];

export const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e3-5', source: '3', target: '5', animated: true, type: 'step' },
  { id: 'e3-6', source: '3', target: '6', animated: true, type: 'step' },
];
