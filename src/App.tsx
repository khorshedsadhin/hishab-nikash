import { useState } from 'react';
import { CloseMonth } from '@/components/CloseMonth';
import type { EntryMode } from '@/components/EntryForm';
import { EntrySheet } from '@/components/EntrySheet';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import type { View } from '@/components/layout/nav';
import { deriveMonth } from '@/lib/model';
import { useStore } from '@/state/store';
import { MoreView } from '@/views/MoreView';
import { PlanView } from '@/views/PlanView';
import { ReviewView } from '@/views/ReviewView';
import { TodayView } from '@/views/TodayView';

export function App() {
  const { state } = useStore();
  const [view, setView] = useState<View>('today');
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<EntryMode>('spend');
  const [closing, setClosing] = useState<string | null>(null);
  const m = state.months[state.activeMonth];
  const d = deriveMonth(state, state.activeMonth);

  function go(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onView={go} onAdd={() => setSheet(true)} />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
        {view === 'today' && <TodayView m={m} d={d} mode={mode} onMode={setMode} onCloseMonth={setClosing} />}
        {view === 'plan' && <PlanView m={m} d={d} />}
        {view === 'review' && <ReviewView m={m} d={d} onCloseMonth={setClosing} />}
        {view === 'more' && <MoreView onOpenMonth={() => go('today')} />}
      </main>
      <MobileNav view={view} onView={go} onAdd={() => setSheet(true)} />
      <EntrySheet open={sheet} onOpenChange={setSheet} mode={mode} onMode={setMode} m={m} d={d} />
      <CloseMonth
        monthKey={closing}
        onClose={() => setClosing(null)}
        onDone={() => {
          setClosing(null);
          go('today');
        }}
      />
    </div>
  );
}
