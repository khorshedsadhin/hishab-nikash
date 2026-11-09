import { ChartLine, House, ListChecks, UserRound, type LucideIcon } from 'lucide-react';

export type View = 'today' | 'plan' | 'review' | 'more';

export const VIEWS: { key: View; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: 'আজ', icon: House },
  { key: 'plan', label: 'প্ল্যান', icon: ListChecks },
  { key: 'review', label: 'রিভিউ', icon: ChartLine },
  { key: 'more', label: 'আরও', icon: UserRound }
];
