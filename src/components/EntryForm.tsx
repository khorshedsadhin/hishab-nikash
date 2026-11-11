import { useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/NumberInput';
import { addDaysISO, pad, todayISO, uid } from '@/lib/dates';
import { money, monthLabel, shortDay } from '@/lib/format';
import { CATEGORIES, loanRows, savingsHeld, type CatKey, type Derived, type LoanSource, type LogEntry, type Month } from '@/lib/model';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export type EntryMode = 'spend' | 'income' | 'loan';

/* A spend picks a plan line; this marks the free-text fallback. */
const NEW = '__new';

/* The last category used, so a run of similar spends needs one tap less. */
let lastCat: CatKey = CATEGORIES[0].key;

const chip = 'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors';
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
      ) : m.locked ? (
        <LockedIncome m={m} />
      ) : (
        <IncomeForm d={d} onDone={onDone} />
      )}
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

/* Today and yesterday as one tap each; any other day through the picker. */
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
              /* older browsers open the picker on their own */
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function SpendForm({ m, d, onDone, entry, onDelete }: {
  m: Month;
  d: Derived;
  onDone?: () => void;
  /* Set when editing an entry that is already written. */
  entry?: LogEntry;
  onDelete?: () => void;
}) {
  const { state, dispatch } = useStore();
  const range = useDateRange(d);
  const [amount, setAmount] = useState<number | null>(entry ? entry.amount : null);
  const [cat, setCat] = useState<string>(entry ? entry.cat : lastCat);
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
  const left = d.perCategory[cat].planned - d.perCategory[cat].actual + own;
  const amt = amount ?? 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amt <= 0) {
      toast.error('কত টাকা খরচ হলো লেখো।');
      amountRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    const key = when.slice(0, 7);
    const target = state.months[key];
    if (!target) {
      toast.error(monthLabel(key) + ' এখনো খোলা হয়নি।');
      return;
    }
    const pickId = showName ? '' : pickValue;
    const label = showName ? name : '';
    if (entry) {
      dispatch({ type: 'updateLog', id: entry.id, date: when, cat, amount: amt, pick: pickId, name: label });
      toast.success('খরচ বদলানো হয়েছে।');
    } else {
      const before = { log: target.log, loggedDays: target.loggedDays };
      dispatch({ type: 'addSpend', date: when, cat, amount: amt, pick: pickId, name: label });
      lastCat = cat as CatKey;
      undoToast(money(amt) + ' খরচ লেখা হয়েছে।', () => dispatch({ type: 'restoreLogList', month: key, ...before }));
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

/* Lending out: the money leaves either the spendable pool or the savings, never both. */
function LoanForm({ d, onDone }: { d: Derived; onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const range = useDateRange(d);
  const m = state.months[state.activeMonth];
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [from, setFrom] = useState<LoanSource>('spend');
  const [date, setDate] = useState(range.initial);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amt = amount ?? 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amt <= 0) {
      toast.error('কত টাকা ধার দিলে লেখো।');
      amountRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      toast.error('কাকে ধার দিলে লেখো।');
      nameRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    const key = when.slice(0, 7);
    if (!state.months[key]) {
      toast.error(monthLabel(key) + ' এখনো খোলা হয়নি।');
      return;
    }
    const loan = { id: uid(), date: when, name, amount: amt, from };
    dispatch({ type: 'addLoan', loan });
    undoToast(money(amt) + ' ধার লেখা হয়েছে।', () => dispatch({ type: 'deleteLoan', month: key, id: loan.id }));
    setAmount(null);
    setName('');
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

  const sources = [
    { key: 'spend', label: 'খরচের টাকা থেকে' },
    { key: 'savings', label: 'সঞ্চয় থেকে' }
  ] as const;

  return (
    <form onSubmit={submit} className="grid gap-4" style={{ '--tint': 'var(--primary)' } as CSSProperties}>
      <AmountInput value={amount} onChange={setAmount} inputRef={amountRef} label="কত টাকা ধার দিলে" />
      <Input
        ref={nameRef}
        placeholder="কাকে দিলে"
        aria-label="কাকে দিলে"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-xl"
      />
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">কোন টাকা থেকে দিলে?</legend>
        <div className="flex flex-wrap gap-2">
          {sources.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={from === o.key}
              onClick={() => setFrom(o.key)}
              className={cn(chip, from === o.key ? chipOn : chipOff)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {amt > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {from === 'spend'
              ? 'খরচের টাকা বাকি থাকবে ' + money(d.remaining - amt) + '। সঞ্চয় একই থাকবে।'
              : 'সঞ্চয় হবে ' + money(Math.max(0, savingsHeld(m) - amt)) + '। খরচের টাকা একই থাকবে।'}
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">কবে দিলে</legend>
        <DatePick value={date} onChange={setDate} start={range.start} end={range.end} />
      </fieldset>
      <Button type="submit" className="h-12 rounded-xl font-fig text-base font-semibold">
        {amt > 0 ? money(amt) + ' ধার লেখো' : 'ধার লেখো'}
      </Button>
    </form>
  );
}

/* A locked plan takes no new income, but money it already expects can still arrive. */
function LockedIncome({ m }: { m: Month }) {
  const { state, dispatch } = useStore();
  const waiting = m.incomes.filter((x) => x.date == null);
  const today = todayISO();
  const when = today.slice(0, 7) === state.activeMonth ? today : state.activeMonth + '-01';
  return (
    <div className="grid gap-3">
      {waiting.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">যে আয় আসার কথা, এলে চাপো:</p>
          {waiting.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-xl border px-4 py-2">
              <span className="min-w-0 flex-1 truncate">{x.name || 'আয়'}</span>
              <span className="font-fig">{money(x.amount)}</span>
              <Button
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  dispatch({ type: 'receiveIncome', id: x.id, date: when });
                  undoToast(money(x.amount) + ' এসেছে।', () => dispatch({ type: 'receiveIncome', id: x.id, date: null }));
                }}
              >
                এলো
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="rounded-2xl bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
        প্ল্যান লক করা, তাই নতুন আয় যোগ করা যাবে না। প্ল্যান পেজ থেকে আনলক করে যোগ করো।
      </p>
    </div>
  );
}

function IncomeForm({ d, onDone }: { d: Derived; onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const range = useDateRange(d);
  const open = loanRows(state).filter((r) => r.left > 0);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(range.initial);
  const [share, setShare] = useState<'none' | 'half' | 'all'>('none');
  const [repeat, setRepeat] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const amt = amount ?? 0;
  const toSavings = share === 'all' ? amt : share === 'half' ? Math.round(amt / 2) : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amt <= 0) {
      toast.error('কত টাকা এলো লেখো।');
      amountRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    if (!state.months[when.slice(0, 7)]) {
      toast.error(monthLabel(when.slice(0, 7)) + ' এখনো খোলা হয়নি।');
      return;
    }
    const id = uid();
    dispatch({ type: 'addIncome', id, name, amount: amt, date: when, repeat: loanId ? false : repeat, toSavings, ...(loanId ? { loanId } : {}) });
    undoToast(money(amt) + ' আয় যোগ হয়েছে।', () => dispatch({ type: 'undoIncome', month: when.slice(0, 7), id, toSavings }));
    setAmount(null);
    setName('');
    setShare('none');
    setRepeat(false);
    setLoanId(null);
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

  /* Choosing a loan fills in the name and the amount still owed. */
  function pickLoan(r: (typeof open)[number] | null) {
    setLoanId(r ? r.loan.id : null);
    setName(r ? 'ধার ফেরত, ' + r.loan.name : '');
    if (r && !amount) setAmount(r.left);
  }

  const shares = [
    { key: 'none', label: 'সবটা খরচের টাকায়' },
    { key: 'half', label: 'অর্ধেক সঞ্চয়ে' },
    { key: 'all', label: 'সবটা সঞ্চয়ে' }
  ] as const;

  return (
    <form onSubmit={submit} className="grid gap-4" style={{ '--tint': 'var(--primary)' } as CSSProperties}>
      <AmountInput value={amount} onChange={setAmount} inputRef={amountRef} label="কত টাকা এলো" />
      {open.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">এটা কি ধার ফেরত?</legend>
          <div className="flex flex-wrap gap-2">
            {open.map((r) => (
              <button
                key={r.loan.id}
                type="button"
                aria-pressed={loanId === r.loan.id}
                onClick={() => pickLoan(loanId === r.loan.id ? null : r)}
                className={cn(chip, loanId === r.loan.id ? chipOn : chipOff)}
              >
                {r.loan.name || 'ধার'} · {money(r.left)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {!loanId && (
        <Input
          placeholder="কোথা থেকে, যেমন বেতন বা প্রজেক্ট"
          aria-label="আয়ের নাম"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-xl"
        />
      )}
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
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">কবে এলো</legend>
        <DatePick value={date} onChange={setDate} start={range.start} end={range.end} />
      </fieldset>
      {!loanId && <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
          className="size-4.5 accent-primary"
        />
        প্রতি মাসে আসে (পরের মাসের প্ল্যানে আপনা থেকে থাকবে)
      </label>}
      <Button type="submit" className="h-12 rounded-xl font-fig text-base font-semibold">
        {amt > 0 ? money(amt) + ' আয় যোগ করো' : 'আয় যোগ করো'}
      </Button>
    </form>
  );
}
