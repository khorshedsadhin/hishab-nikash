import { useState, useSyncExternalStore } from 'react';
import { CalendarPlus, ChevronRight, Download, Moon, Sun, Trash2, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { LoanList } from '@/components/LoanList';
import { Panel, PanelTitle } from '@/components/Panel';
import { AccountButton } from '@/components/layout/AccountButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { SyncBadge } from '@/components/layout/SyncBadge';
import { nextMonthKey, todayISO } from '@/lib/dates';
import { money, monthLabel } from '@/lib/format';
import { type State } from '@/lib/model';
import { exportData, parseImport } from '@/lib/storage';
import { getStatus, subscribe } from '@/lib/sync';
import { setTheme, useTheme } from '@/lib/theme';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

const row = 'flex min-h-14 w-full items-center gap-3 px-5 text-left text-[15px] hover:bg-muted/50';

export function MoreView({ onOpenMonth }: { onOpenMonth: () => void }) {
  const { state, dispatch } = useStore();
  const sync = useSyncExternalStore(subscribe, getStatus);
  const keys = Object.keys(state.months).sort().reverse();
  const current = todayISO().slice(0, 7);
  const nextKey = nextMonthKey(keys[0]);

  return (
    <>
      <PageHeader title="আরও" />
      {/* Columns size to their own content; the month list spans both rows on wide screens. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel>
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <UserRound className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{sync.username || 'লগ ইন করা নেই'}</div>
              <SyncBadge className="mt-1 border-0 bg-transparent px-0" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {sync.username
              ? 'ফোন আর কম্পিউটারে একই অ্যাকাউন্টে লগ ইন করলে সব জায়গায় একই হিসাব থাকে।'
              : 'অ্যাকাউন্ট খুললে হিসাব সার্ভারে থাকে, ফোন আর কম্পিউটার দুই জায়গা থেকেই লেখা যায়।'}
          </p>
          <div className="mt-3 rounded-xl border">
            <AccountButton withLabel />
          </div>
        </Panel>

        <Panel className="overflow-hidden p-0 md:p-0 lg:row-span-3">
          <PanelTitle className="mb-0 px-5 pt-5 pb-2">মাস</PanelTitle>
          <div className="divide-y border-t">
            {keys.map((k) => {
              const m = state.months[k];
              const tag = k === current
                ? 'চলছে'
                : k > current
                  ? 'আগামী'
                  : m.closed
                    ? (m.saved != null ? money(m.saved) + ' জমেছে' : 'বন্ধ')
                    : 'বন্ধ করা বাকি';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'selectMonth', key: k });
                    onOpenMonth();
                  }}
                  className={row}
                >
                  <span className={cn('flex-1', k === state.activeMonth && 'font-medium')}>{monthLabel(k)}</span>
                  <span className={cn('text-xs', k === current ? 'text-primary' : 'text-muted-foreground')}>{tag}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'selectMonth', key: keys[0] });
                dispatch({ type: 'openNextMonth' });
                toast.success(monthLabel(nextKey) + ' খোলা হয়েছে। শুধু প্রতি মাসের লাইন আর আয় এসেছে।');
              }}
              className={cn(row, 'text-primary')}
            >
              <CalendarPlus className="size-4.5" />
              {monthLabel(nextKey)} খোলো
            </button>
            <DeleteMonth />
          </div>
        </Panel>

        <LoanList />

        <Panel className="p-0 md:p-0">
          <PanelTitle className="mb-0 px-5 pt-5 pb-2">সেটিংস</PanelTitle>
          <div className="divide-y border-t">
            <ThemeRow />
            <Backup />
          </div>
        </Panel>
      </div>
    </>
  );
}

function ThemeRow() {
  const theme = useTheme();
  return (
    <div className="flex min-h-14 items-center gap-3 px-5">
      {theme === 'dark' ? <Moon className="size-4.5 text-muted-foreground" /> : <Sun className="size-4.5 text-muted-foreground" />}
      <span className="flex-1 text-[15px]">থিম</span>
      <div role="radiogroup" aria-label="থিম" className="flex rounded-xl bg-muted p-1">
        {(['dark', 'light'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            onClick={() => setTheme(t)}
            className={cn(
              'min-h-8 rounded-lg px-3 text-sm',
              theme === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t === 'dark' ? 'ডার্ক' : 'লাইট'}
          </button>
        ))}
      </div>
    </div>
  );
}

function Backup() {
  const { state, dispatch } = useStore();
  const [pending, setPending] = useState<State | null>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImport(String(reader.result));
      if ('error' in result) toast.error(result.error);
      else setPending(result.state);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <button type="button" className={row} onClick={() => exportData(state)}>
        <Download className="size-4.5 text-muted-foreground" />
        <span className="flex-1">ব্যাকআপ নামাও</span>
      </button>
      <label className={cn(row, 'cursor-pointer')}>
        <Upload className="size-4.5 text-muted-foreground" />
        <span className="flex-1">ব্যাকআপ ফেরত আনো</span>
        <input
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

      <AlertDialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যাকআপ ফেরত আনবে?</AlertDialogTitle>
            <AlertDialogDescription>এখনকার সব ডেটা মুছে ফাইলেরটা বসবে। ঠিক আছে?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) dispatch({ type: 'importState', state: pending });
                setPending(null);
              }}
            >
              হ্যাঁ, বসাও
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DeleteMonth() {
  const { state, dispatch } = useStore();
  const label = monthLabel(state.activeMonth);

  return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className={cn(row, 'text-danger hover:bg-danger/8')}>
            <Trash2 className="size-4.5" />
            {label} মুছে ফেলো
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label} মুছে ফেলবে?</AlertDialogTitle>
            <AlertDialogDescription>
              এই মাসের প্ল্যান, আয়, খরচ, মিলানো সব মুছে যাবে। মুছে ফেলার পর কয়েক সেকেন্ড ফেরত আনার সুযোগ থাকবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const key = state.activeMonth;
                const month = state.months[key];
                dispatch({ type: 'deleteMonth' });
                undoToast(label + ' মুছে ফেলা হয়েছে।', () => dispatch({ type: 'restoreMonth', key, month }));
              }}
            >
              হ্যাঁ, মুছে ফেলো
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
