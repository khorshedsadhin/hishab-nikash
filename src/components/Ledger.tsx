import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { todayISO } from '@/lib/dates';
import { dayLabel, money } from '@/lib/format';
import { CATEGORIES, catLabel, deriveMonth, type LogEntry } from '@/lib/model';
import { undoToast } from '@/lib/undo';
import { useStore } from '@/state/store';
import { SpendForm } from './EntryForm';

export function Ledger({ log, days }: { log: LogEntry[]; days?: number }) {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<LogEntry | null>(null);

  function remove(entry: LogEntry) {
    const month = state.activeMonth;
    const index = state.months[month].log.findIndex((e) => e.id === entry.id);
    dispatch({ type: 'deleteLog', id: entry.id });
    undoToast('খরচ মুছে ফেলা হয়েছে।', () => dispatch({ type: 'restoreLog', month, entry, index }));
    setEditing(null);
  }

  const editor = (
    <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto rounded-3xl bg-card p-5 sm:max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div>
          <DialogTitle className="font-fig text-xl">খরচ বদলাও</DialogTitle>
          <DialogDescription className="sr-only">লেখা খরচের টাকা, খাত, নাম বা তারিখ বদলাও</DialogDescription>
        </div>
        {editing && (
          <SpendForm
            key={editing.id}
            m={state.months[state.activeMonth]}
            d={deriveMonth(state, state.activeMonth)}
            entry={editing}
            onDone={() => setEditing(null)}
            onDelete={() => remove(editing)}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  if (!log.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        এখনো কোনো খরচ লেখা হয়নি। <b className="font-medium text-foreground">+</b> চেপে প্রথম খরচটা লিখে ফেলো।
      </p>
    );
  }

  const sorted = log.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const byDate: Record<string, LogEntry[]> = {};
  let order: string[] = [];
  sorted.forEach((e) => {
    if (!byDate[e.date]) {
      byDate[e.date] = [];
      order.push(e.date);
    }
    byDate[e.date].push(e);
  });
  if (days) order = order.slice(0, days);

  const todayStr = todayISO();
  return (
    <>
      <div className="divide-y divide-border">
        {order.map((date) => {
          const entries = byDate[date];
          const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <div key={date} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between px-2 py-1 text-sm text-muted-foreground">
                <span>{date === todayStr ? 'আজ' : dayLabel(date)}</span>
                <span className="font-fig text-foreground">{money(total)}</span>
              </div>
              {entries.map((e) => {
                const tint = CATEGORIES.find((c) => c.key === e.cat)?.tint ?? 'var(--muted-foreground)';
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEditing(e)}
                    aria-label={(e.name || catLabel(e.cat)) + ', ' + money(e.amount) + ', বদলাও'}
                    className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted/60"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: tint }} />
                    <span className="min-w-0 flex-1 truncate">
                      {e.name || <span className="text-muted-foreground">{catLabel(e.cat)}</span>}
                    </span>
                    {e.name && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{catLabel(e.cat)}</span>}
                    <span className="shrink-0 text-right font-fig">{money(e.amount)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {editor}
    </>
  );
}
