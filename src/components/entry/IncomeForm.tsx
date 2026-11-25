import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { defaultDateIn } from '@/lib/dates';
import { money } from '@/lib/format';
import { loanBook, loanName, repaymentFor, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore, useUndoable } from '@/state/store';
import { AmountInput, chip, chipOff, chipOn, DatePick, entryDate, useEntryDates } from './fields';

/* A locked plan takes no new income, but money it already expects can still arrive. */
export function LockedIncome({ m }: { m: Month }) {
  const { state } = useStore();
  const run = useUndoable();
  const waiting = m.incomes.filter((x) => x.date == null);
  const when = defaultDateIn(state.activeMonth);
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
                  run({ type: 'receiveIncome', id: x.id, date: when }, money(x.amount) + ' এসেছে।');
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

export function IncomeForm({ onDone }: { onDone?: () => void }) {
  const { state } = useStore();
  const run = useUndoable();
  const range = useEntryDates();
  const { open } = loanBook(state);
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
    const when = entryDate(state, amt, date, 'কত টাকা এলো লেখো।', amountRef);
    if (!when) return;
    run(
      { type: 'addIncome', name, amount: amt, date: when, repeat: loanId ? false : repeat, toSavings, ...(loanId ? { loanId } : {}) },
      money(amt) + ' আয় যোগ হয়েছে।'
    );
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
    const pay = r ? repaymentFor(r) : null;
    setLoanId(pay ? pay.loanId : null);
    setName(pay ? pay.name : '');
    if (pay && !amount) setAmount(pay.amount);
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
                {loanName(r.loan)} · {money(r.left)}
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
