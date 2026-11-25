import { Check, Trash2 } from 'lucide-react';
import { Panel, PanelTitle } from '@/components/Panel';
import { dayLabel, money } from '@/lib/format';
import { loanBook, loanName, loanSourceLabel, type LoanRow } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore, useUndoable } from '@/state/store';

/* Every loan across all months; paying one back is done from the income form. */
export function LoanList() {
  const { state } = useStore();
  const run = useUndoable();
  const { open, closed: done, owed } = loanBook(state);
  const empty = open.length === 0 && done.length === 0;

  function remove(r: LoanRow) {
    run({ type: 'deleteLoan', id: r.loan.id }, 'ধার মুছে ফেলা হয়েছে।');
  }

  return (
    <Panel className="p-0 md:p-0">
      <PanelTitle
        className="mb-0 px-5 pt-5 pb-2"
        action={owed > 0 && <span className="font-fig text-sm text-muted-foreground">বাকি {money(owed)}</span>}
      >
        ধার
      </PanelTitle>
      <div className="divide-y border-t">
        {empty && (
          <p className="px-5 py-5 text-sm text-muted-foreground">
            কাউকে ধার দিলে এখানে থাকবে। লেখো থেকে <b className="font-medium text-foreground">ধার</b> ট্যাবে লেখো।
          </p>
        )}
        {open.map((r) => <Row key={r.loan.id} r={r} onDelete={() => remove(r)} />)}
        {done.length > 0 && (
          <div className="px-5 py-2 text-xs text-muted-foreground">ফেরত পেয়েছি</div>
        )}
        {done.map((r) => <Row key={r.loan.id} r={r} onDelete={() => remove(r)} />)}
      </div>
    </Panel>
  );
}

function Row({ r, onDelete }: { r: LoanRow; onDelete: () => void }) {
  const cleared = r.left <= 0;
  return (
    <div className={cn('flex min-h-14 items-center gap-3 px-5 py-2', cleared && 'text-muted-foreground')}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px]">{loanName(r.loan)}</div>
        <div className="text-xs text-muted-foreground">
          {dayLabel(r.loan.date)} · {loanSourceLabel(r.loan.from)}
          {!cleared && r.returned > 0 && ' · ' + money(r.returned) + ' ফেরত এসেছে'}
        </div>
      </div>
      {cleared ? (
        <span className="flex items-center gap-1.5 font-fig"><Check className="size-4 text-success" />{money(r.loan.amount)}</span>
      ) : (
        <span className="shrink-0 font-fig">{money(r.left)}</span>
      )}
      <button
        type="button"
        aria-label="ধার মুছে ফেলো"
        onClick={onDelete}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-danger"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
