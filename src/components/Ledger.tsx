import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { todayISO } from '@/lib/dates';
import { dayLabel, money } from '@/lib/format';
import { CATEGORIES, catLabel, type LogEntry } from '@/lib/model';
import { useStore } from '@/state/store';

export function Ledger({ log, limit }: { log: LogEntry[]; limit?: number }) {
  const { dispatch } = useStore();

  if (!log.length) {
    return <p className="py-6 text-center font-light text-muted-foreground">উপরে প্রথম খরচটা লিখে ফেলো, দিনের হিসাব এখানে জমবে।</p>;
  }

  let sorted = log.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (limit) sorted = sorted.slice(0, limit);

  const byDate: Record<string, LogEntry[]> = {};
  const order: string[] = [];
  sorted.forEach((e) => {
    if (!byDate[e.date]) {
      byDate[e.date] = [];
      order.push(e.date);
    }
    byDate[e.date].push(e);
  });

  const todayStr = todayISO();
  return (
    <div className="divide-y divide-border">
      {order.map((date) => {
        const entries = byDate[date];
        const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
        return (
          <div key={date} className="py-2 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between py-1 text-sm text-muted-foreground">
              <span>{date === todayStr ? 'আজ' : dayLabel(date)}</span>
              <span className="font-fig text-base text-foreground">{money(total)}</span>
            </div>
            {entries.map((e) => {
              const tint = CATEGORIES.find((c) => c.key === e.cat)?.tint ?? 'var(--muted-foreground)';
              return (
                <div key={e.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: tint }} />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {e.name || <span className="font-light text-muted-foreground">নাম লেখা হয়নি</span>}
                  </span>
                  <span className="shrink-0 text-xs font-light text-muted-foreground">{catLabel(e.cat)}</span>
                  <span className="w-20 shrink-0 text-right font-fig">{money(e.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-danger"
                    aria-label="মুছে ফেলো"
                    onClick={() => dispatch({ type: 'deleteLog', id: e.id })}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
