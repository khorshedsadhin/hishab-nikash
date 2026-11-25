import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';
import { CATEGORIES, type CatKey, type Derived, type LogEntry, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore, useUndoable } from '@/state/store';
import { AmountInput, chip, chipOff, chipOn, DatePick, entryDate, lastCategory, rememberCategory, useEntryDates } from './fields';

/* A spend picks a plan line; this marks the free-text fallback. */
const NEW = '__new';

export function SpendForm({ m, d, onDone, entry, onDelete }: {
  m: Month;
  d: Derived;
  onDone?: () => void;
  entry?: LogEntry;
  onDelete?: () => void;
}) {
  const { state, dispatch } = useStore();
  const run = useUndoable();
  const range = useEntryDates();
  const [amount, setAmount] = useState<number | null>(entry ? entry.amount : null);
  const [cat, setCat] = useState<string>(entry ? entry.cat : lastCategory());
  const [pick, setPick] = useState(entry ? (entry.lineId ?? (entry.name ? NEW : '')) : '');
  const [name, setName] = useState(entry && !entry.lineId ? entry.name : '');
  const [date, setDate] = useState(entry ? entry.date : range.initial);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const lines = (m.budget[cat] || []).filter((l) => l.name.trim());
  const pickValue = lines.some((l) => l.id === pick) || pick === NEW ? pick : (lines[0]?.id ?? NEW);
  const showName = pickValue === NEW;
  const tint = CATEGORIES.find((c) => c.key === cat)!.tint;
  const own = entry && entry.cat === cat ? entry.amount : 0;
  const left = d.perCategory[cat].left + own;
  const amt = amount ?? 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    const when = entryDate(state, amt, date, 'কত টাকা খরচ হলো লেখো।', amountRef);
    if (!when) return;
    const pickId = showName ? '' : pickValue;
    const label = showName ? name : '';
    if (entry) {
      dispatch({ type: 'updateLog', id: entry.id, date: when, cat, amount: amt, pick: pickId, name: label });
      toast.success('খরচ বদলানো হয়েছে।');
    } else {
      run({ type: 'addSpend', date: when, cat, amount: amt, pick: pickId, name: label }, money(amt) + ' খরচ লেখা হয়েছে।');
      rememberCategory(cat as CatKey);
      setAmount(null);
      setPick('');
      setName('');
    }
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <AmountInput value={amount} onChange={setAmount} inputRef={amountRef} label="কত টাকা" />
        <p className={cn('mt-1.5 min-h-4 text-center text-xs', left - amt < 0 ? 'text-danger' : 'text-muted-foreground')}>
          {d.perCategory[cat].planned > 0
            ? left - amt < 0 ? 'এই খাতে ' + money(amt - left) + ' বেশি হয়ে যাবে' : 'এই খাতে বাকি থাকবে ' + money(left - amt)
            : 'এই খাতে প্ল্যান নেই'}
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">খাত</legend>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={cat === c.key}
              onClick={() => {
                setCat(c.key);
                setPick('');
                setName('');
              }}
              style={{ '--tint': c.tint } as CSSProperties}
              className={cn(chip, 'min-h-11 rounded-xl', cat === c.key ? chipOn : chipOff)}
            >
              <span className="size-2.5 rounded-full bg-(--tint)" />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">কীসে খরচ</legend>
        <div className="flex flex-wrap gap-2" style={{ '--tint': tint } as CSSProperties}>
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={pickValue === l.id}
              onClick={() => {
                setPick(l.id);
                setName('');
              }}
              className={cn(chip, pickValue === l.id ? chipOn : chipOff)}
            >
              {l.name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={showName}
            onClick={() => {
              setPick(NEW);
              setTimeout(() => nameRef.current?.focus());
            }}
            className={cn(chip, 'border-dashed', showName ? chipOn : chipOff)}
          >
            <Plus className="size-3.5" />
            {lines.length ? 'অন্য কিছু' : 'নাম লেখো'}
          </button>
        </div>
        {showName && (
          <Input
            ref={nameRef}
            placeholder="কীসে খরচ হলো"
            aria-label="কীসে খরচ হলো"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 h-11 rounded-xl"
          />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">কবে</legend>
        <DatePick value={date} onChange={setDate} start={range.start} end={range.end} />
      </fieldset>

      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="outline" className="h-12 rounded-xl text-danger hover:text-danger" onClick={onDelete}>
            <Trash2 />
            মুছে ফেলো
          </Button>
        )}
        <Button type="submit" className="h-12 flex-1 rounded-xl font-fig text-base font-semibold">
          {entry ? 'বদলাও' : amt > 0 ? money(amt) + ' খরচ লেখো' : 'খরচ লেখো'}
        </Button>
      </div>
    </form>
  );
}
