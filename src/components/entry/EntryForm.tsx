import { canEdit, type Derived, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { IncomeForm, LockedIncome } from './IncomeForm';
import { LoanForm } from './LoanForm';
import { SpendForm } from './SpendForm';

export type EntryMode = 'spend' | 'income' | 'loan';

export function EntryForm({ m, d, mode, onMode, onDone }: {
  m: Month;
  d: Derived;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onDone?: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="কী লিখবে" className="grid grid-cols-3 rounded-xl bg-muted p-1">
        {(['spend', 'income', 'loan'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => onMode(k)}
            className={cn(
              'min-h-10 rounded-lg text-sm font-medium transition-colors',
              mode === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {k === 'spend' ? 'খরচ' : k === 'income' ? 'আয়' : 'ধার'}
          </button>
        ))}
      </div>
      {mode === 'spend' ? (
        <SpendForm m={m} d={d} onDone={onDone} />
      ) : mode === 'loan' ? (
        <LoanForm d={d} onDone={onDone} />
      ) : canEdit(m, 'plan') ? (
        <IncomeForm onDone={onDone} />
      ) : (
        <LockedIncome m={m} />
      )}
    </div>
  );
}
