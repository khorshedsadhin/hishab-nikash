import { useState } from 'react';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import type { View } from '@/components/layout/nav';
import { deriveMonth } from '@/lib/model';
import { useStore } from '@/state/store';
import { MonthView } from '@/views/MonthView';
import { PlanView } from '@/views/PlanView';
import { TodayView } from '@/views/TodayView';

export function App() {
  const { state } = useStore();
  const [view, setView] = useState<View>('today');
  const m = state.months[state.activeMonth];
  const d = deriveMonth(state, state.activeMonth);

  function go(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onView={go} />
      <div className="min-w-0 flex-1">
        <Topbar view={view} />
        <main className="mx-auto max-w-7xl px-4 pt-5 pb-24 md:px-8 md:pt-8 md:pb-12">
          {view === 'today' && <TodayView m={m} d={d} />}
          {view === 'plan' && <PlanView m={m} d={d} />}
          {view === 'month' && <MonthView m={m} d={d} />}
        </main>
      </div>
      <MobileNav view={view} onView={go} />
    </div>
  );
}
