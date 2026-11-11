import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { todayISO } from '@/lib/dates';
import { dayLabel, money } from '@/lib/format';
import { CATEGORIES, catLabel, deriveMonth, type Loan, type LogEntry } from '@/lib/model';
import { undoToast } from '@/lib/undo';
import { useStore } from '@/state/store';
import { SpendForm } from './EntryForm';

/* Spends and loans share one timeline; a loan opens the loan list rather than the spend editor. */
export function Ledger({ log, loans = [], days, onLoans }: { log: LogEntry[]; loans?: Loan[]; days?: number; onLoans?: () => void }) {
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

  if (!log.length && !loans.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        এখনো কোনো খরচ লেখা হয়নি। <b className="font-medium text-foreground">+</b> চেপে প্রথম খরচটা লিখে ফেলো।
      </p>
    );
  }

  type Item = { date: string; entry?: LogEntry; loan?: Loan };
  const items: Item[] = [
    ...log.map((entry) => ({ date: entry.date, entry })),
    ...loans.map((loan) => ({ date: loan.date, loan }))
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const byDate: Record<string, Item[]> = {};
  let order: string[] = [];
  items.forEach((it) => {
    if (!byDate[it.date]) {
      byDate[it.date] = [];
      order.push(it.date);
    }
    byDate[it.date].push(it);
  });
  if (days) order = order.slice(0, days);

  const todayStr = todayISO();
  return (
    <>
      <div className="divide-y divide-border">
        {order.map((date) => {
          const entries = byDate[date];
          /* A day's total is spending only; lent money is not an expense. */
          const total = entries.reduce((s, it) => s + (it.entry ? it.entry.amount || 0 : 0), 0);
          const spent = entries.some((it) => it.entry);
          return (
            <div key={date} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between px-2 py-1 text-sm text-muted-foreground">
                <span>{date === todayStr ? 'আজ' : dayLabel(date)}</span>
                {spent && <span className="font-fig text-foreground">{money(total)}</span>}
              </div>
              {entries.map((it) => {
                if (it.loan) {
                  const l = it.loan;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={onLoans}
                      aria-label={'ধার, ' + l.name + ', ' + money(l.amount)}
                      className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted/60"
                    >
                      <span className="size-2 shrink-0 rounded-full border border-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">ধার, {l.name}</span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {l.from === 'savings' ? 'সঞ্চয় থেকে' : 'ধার'}
                      </span>
                      <span className="shrink-0 text-right font-fig text-muted-foreground">{money(l.amount)}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                    </button>
                  );
                }
                const e = it.entry!;
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
