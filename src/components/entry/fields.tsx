import { type CSSProperties, type RefObject } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { NumberInput } from '@/components/NumberInput';
import { addDaysISO, defaultDateIn, monthRange, todayISO } from '@/lib/dates';
import { monthLabel, shortDay } from '@/lib/format';
import { CATEGORIES, type CatKey, type State } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export const chip = 'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors';
export const chipOn = 'border-(--tint) bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-foreground';
export const chipOff = 'border-input text-muted-foreground hover:text-foreground';

/* The last category used, so a run of similar spends needs one tap less. */
let lastCat: CatKey = CATEGORIES[0].key;

export function lastCategory(): CatKey {
  return lastCat;
}

export function rememberCategory(cat: CatKey) {
  lastCat = cat;
}

/* The dates an entry for the active month may take, and where it starts. */
export function useEntryDates() {
  const { state } = useStore();
  const range = monthRange(state.activeMonth);
  return { ...range, initial: defaultDateIn(state.activeMonth) };
}

/* An entry needs an amount and a month to land in; returns the date to save on, or null after saying why. */
export function entryDate(state: State, amount: number, date: string, emptyText: string, amountRef: RefObject<HTMLInputElement | null>): string | null {
  if (amount <= 0) {
    toast.error(emptyText);
    amountRef.current?.focus();
    return null;
  }
  const when = date || todayISO();
  const key = when.slice(0, 7);
  if (!state.months[key]) {
    toast.error(monthLabel(key) + ' এখনো খোলা হয়নি।');
    return null;
  }
  return when;
}

export function AmountInput({ value, onChange, inputRef, label }: {
  value: number | null;
  onChange: (v: number | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
}) {
  return (
    <NumberInput
      ref={inputRef}
      nullable
      data-amount
      placeholder="0"
      aria-label={label}
      value={value}
      onValue={onChange}
      className="h-16 rounded-2xl text-center font-fig text-4xl font-semibold md:text-4xl"
    />
  );
}

export /* Today and yesterday as one tap each; any other day through the picker. */
function DatePick({ value, onChange, start, end }: { value: string; onChange: (v: string) => void; start: string; end: string }) {
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const quick = [
    { date: today, label: 'আজ' },
    { date: yesterday, label: 'গতকাল' }
  ].filter((q) => q.date >= start && q.date <= end);
  const other = !quick.some((q) => q.date === value);
  return (
    <div className="flex flex-wrap gap-2" style={{ '--tint': 'var(--primary)' } as CSSProperties}>
      {quick.map((q) => (
        <button
          key={q.date}
          type="button"
          aria-pressed={value === q.date}
          onClick={() => onChange(q.date)}
          className={cn(chip, value === q.date ? chipOn : chipOff)}
        >
          {q.label}
        </button>
      ))}
      <label className={cn(chip, 'relative cursor-pointer', other ? chipOn : chipOff)}>
        <CalendarDays className="size-4" />
        {other ? shortDay(value) : 'অন্য দিন'}
        <input
          type="date"
          aria-label="তারিখ"
          value={value}
          min={start}
          max={end}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              /* Older browsers open the picker on their own. */
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
