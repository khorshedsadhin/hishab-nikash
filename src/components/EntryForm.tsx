import { useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pad, todayISO } from '@/lib/dates';
import { money, monthLabel } from '@/lib/format';
import { CATEGORIES, type Derived, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export type EntryMode = 'spend' | 'income';

/* A spend picks a plan line; this marks the free-text fallback. */
const NEW = '__new';

const chip = 'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors';
const chipOn = 'border-(--tint) bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-foreground';
const chipOff = 'border-input text-muted-foreground hover:text-foreground';

export function EntryForm({ m, d, mode, onMode, onDone }: {
  m: Month;
  d: Derived;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onDone?: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="কী লিখবে" className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {(['spend', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => onMode(k)}
            className={cn(
              'min-h-9 rounded-lg text-sm font-medium transition-colors',
              mode === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {k === 'spend' ? 'খরচ' : 'আয়'}
          </button>
        ))}
      </div>
      {mode === 'spend' ? <SpendForm m={m} d={d} onDone={onDone} /> : <IncomeForm d={d} onDone={onDone} />}
    </div>
  );
}

function useDateRange(d: Derived) {
  const { state } = useStore();
  const start = state.activeMonth + '-01';
  const end = state.activeMonth + '-' + pad(d.dim);
  const today = todayISO();
  return { start, end, initial: today >= start && today <= end ? today : start };
}

function AmountInput({ value, onChange, inputRef, label }: {
  value: string;
  onChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
}) {
  return (
    <Input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      placeholder="৳ ০"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-14 rounded-2xl text-center font-fig text-3xl font-semibold md:text-3xl"
    />
  );
}

function SpendForm({ m, d, onDone }: { m: Month; d: Derived; onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const range = useDateRange(d);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>(CATEGORIES[0].key);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(range.initial);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const lines = (m.budget[cat] || []).filter((l) => l.name.trim());
  const pickValue = lines.some((l) => l.id === pick) || pick === NEW ? pick : (lines[0]?.id ?? NEW);
  const showName = pickValue === NEW;
  const tint = CATEGORIES.find((c) => c.key === cat)!.tint;
  const left = d.perCategory[cat].planned - d.perCategory[cat].actual;

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      amountRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    if (!state.months[when.slice(0, 7)]) {
      toast.error(monthLabel(when.slice(0, 7)) + ' এখনো খোলা হয়নি।');
      return;
    }
    dispatch({ type: 'addSpend', date: when, cat, amount: amt, pick: showName ? '' : pickValue, name: showName ? name : '' });
    toast.success(money(amt) + ' খরচ লেখা হয়েছে।');
    setAmount('');
    setPick('');
    setName('');
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <AmountInput value={amount} onChange={setAmount} inputRef={amountRef} label="কত টাকা" />
        {d.perCategory[cat].planned > 0 && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            এই খাতে বাকি {money(left - (Number(amount) || 0))}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2">
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
            নতুন নাম
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

      <div className="flex gap-2">
        <Input
          type="date"
          aria-label="তারিখ"
          value={date}
          min={range.start}
          max={range.end}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-auto rounded-xl"
        />
        <Button type="submit" className="h-12 flex-1 rounded-xl font-fig text-base font-semibold">
          খরচ লেখো
        </Button>
      </div>
    </form>
  );
}

function IncomeForm({ d, onDone }: { d: Derived; onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const range = useDateRange(d);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(range.initial);
  const [share, setShare] = useState<'none' | 'half' | 'all'>('none');
  const [repeat, setRepeat] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const amt = Number(amount) || 0;
  const toSavings = share === 'all' ? amt : share === 'half' ? Math.round(amt / 2) : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amt <= 0) {
      amountRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    if (!state.months[when.slice(0, 7)]) {
      toast.error(monthLabel(when.slice(0, 7)) + ' এখনো খোলা হয়নি।');
      return;
    }
    dispatch({ type: 'addIncome', name, amount: amt, date: when, repeat, toSavings });
    toast.success(money(amt) + ' আয় যোগ হয়েছে।');
    setAmount('');
    setName('');
    setShare('none');
    setRepeat(false);
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

  const shares = [
    { key: 'none', label: 'সবটা খরচের টাকায়' },
    { key: 'half', label: 'অর্ধেক সঞ্চয়ে' },
    { key: 'all', label: 'সবটা সঞ্চয়ে' }
  ] as const;

  return (
    <form onSubmit={submit} className="grid gap-4" style={{ '--tint': 'var(--primary)' } as CSSProperties}>
      <AmountInput value={amount} onChange={setAmount} inputRef={amountRef} label="কত টাকা এলো" />
      <Input
        placeholder="কোথা থেকে, যেমন বেতন বা প্রজেক্ট"
        aria-label="আয়ের নাম"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-xl"
      />
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">এই টাকা দিয়ে কী করবে?</legend>
        <div className="flex flex-wrap gap-2">
          {shares.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={share === s.key}
              onClick={() => setShare(s.key)}
              className={cn(chip, share === s.key ? chipOn : chipOff)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {amt > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            খরচের টাকায় যোগ হবে {money(amt - toSavings)}{toSavings > 0 ? ', সঞ্চয়ের লক্ষ্যে ' + money(toSavings) : ''}
          </p>
        )}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
          className="size-4.5 accent-(--primary)"
        />
        প্রতি মাসে আসে (পরের মাসের প্ল্যানে আপনা থেকে থাকবে)
      </label>
      <div className="flex gap-2">
        <Input
          type="date"
          aria-label="কবে এলো"
          value={date}
          min={range.start}
          max={range.end}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-auto rounded-xl"
        />
        <Button type="submit" className="h-12 flex-1 rounded-xl font-fig text-base font-semibold">
          আয় যোগ করো
        </Button>
      </div>
    </form>
  );
}
