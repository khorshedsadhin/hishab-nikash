import { CalendarRange, LayoutDashboard, ListChecks, type LucideIcon } from 'lucide-react';

export type View = 'today' | 'plan' | 'month';

export const VIEWS: { key: View; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: 'আজ', icon: LayoutDashboard },
  { key: 'plan', label: 'প্ল্যান', icon: ListChecks },
  { key: 'month', label: 'মাস', icon: CalendarRange }
];
