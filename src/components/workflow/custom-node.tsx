
'use client';

import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface CustomNodeData {
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const Icon = data.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="w-48 shadow-lg border-2 border-transparent hover:border-primary/50 transition-colors">
        <CardHeader className="flex flex-row items-center gap-2 p-3">
          <Icon className={cn("w-6 h-6", data.color)} />
          <div>
            <CardTitle className="text-sm">{data.label}</CardTitle>
          </div>
        </CardHeader>
      </Card>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </motion.div>
  );
};
