import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { monthLabel } from '@/lib/format';
import { useStore } from '@/state/store';
import { SyncBadge } from './SyncBadge';

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center gap-3 md:mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-fig text-2xl font-semibold md:text-[28px]">{title}</h1>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </div>
      <SyncBadge className="md:hidden" />
      {children}
    </header>
  );
}

export function MonthPicker() {
  const { state, dispatch } = useStore();
  const keys = Object.keys(state.months).sort().reverse();
  return (
    <Select value={state.activeMonth} onValueChange={(key) => dispatch({ type: 'selectMonth', key })}>
      <SelectTrigger aria-label="মাস" className="h-10! w-auto rounded-xl bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {keys.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
