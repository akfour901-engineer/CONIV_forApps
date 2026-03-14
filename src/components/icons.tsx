
'use client';

import {
  LayoutDashboard,
  AlertTriangle,
  FileText,
  ClipboardList,
  MessageSquare,
  FileClock,
  Wrench,
  IndianRupee,
  Receipt,
  CreditCard,
  ShoppingCart,
  BarChart3,
  PieChart,
  TrendingUp,
  HardHat,
  Package,
  Building2,
  Users,
  FileArchive,
  Landmark,
  ListOrdered,
  Award,
  Sparkles,
  UserCog,
  Map as MapIcon,
  Bot,
  ScanSearch,
  ShieldAlert,
  Store,
  QrCode,
  Clock,
  GanttChart,
  DollarSign,
  Target,
  MailWarning,
  FileSignature,
  Workflow,
  Construction,
  Download,
  Settings,
  Activity,
  Coins,
  Heart,
  Mail,
  Megaphone,
  Briefcase,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'LayoutDashboard' | 'AlertTriangle' | 'FileText' | 'ClipboardList'
  | 'MessageSquare' | 'FileClock' | 'Wrench' | 'IndianRupee' | 'Receipt'
  | 'CreditCard' | 'ShoppingCart' | 'BarChart3' | 'PieChart' | 'TrendingUp'
  | 'HardHat' | 'Package' | 'Building2' | 'Users' | 'FileArchive' | 'Landmark'
  | 'ListOrdered' | 'Award' | 'Sparkles' | 'UserCog' | 'MapIcon'
  | 'Bot' | 'ScanSearch' | 'ShieldAlert' | 'Store' | 'QrCode' | 'Clock'
  | 'GanttChart' | 'DollarSign' | 'Target' | 'MailWarning' | 'FileSignature'
  | 'Workflow' | 'Construction' | 'Download' | 'Settings' | 'Activity'
  | 'Coins' | 'Heart' | 'Mail' | 'Megaphone' | 'Briefcase' | 'ShieldCheck';

const iconMap: { [key in IconName]: LucideIcon } = {
  LayoutDashboard, AlertTriangle, FileText, ClipboardList, MessageSquare,
  FileClock, Wrench, IndianRupee, Receipt, CreditCard, ShoppingCart,
  BarChart3, PieChart, TrendingUp, HardHat, Package, Building2, Users,
  FileArchive, Landmark, ListOrdered, Award, Sparkles, UserCog,
  MapIcon, Bot, ScanSearch, ShieldAlert, Store, QrCode, Clock, GanttChart,
  DollarSign, Target, MailWarning, FileSignature, Workflow, Construction,
  Download, Settings, Activity, Coins, Heart, Mail, Megaphone, Briefcase,
  ShieldCheck,
};

export function getIcon(name: string): LucideIcon | null {
  return iconMap[name as IconName] || null;
}
