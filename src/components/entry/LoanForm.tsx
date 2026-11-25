import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uid } from '@/lib/dates';
import { money } from '@/lib/format';
import { LOAN_SOURCES, type Derived, type LoanSource } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore, useUndoable } from '@/state/store';
import { AmountInput, chip, chipOff, chipOn, DatePick, entryDate, useEntryDates } from './fields';

/* Lending out: the money leaves either the spendable pool or the savings, never both. */
export function LoanForm({ d, onDone }: { d: Derived; onDone?: () => void }) {
  const { state } = useStore();
  const run = useUndoable();
  const range = useEntryDates();
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [from, setFrom] = useState<LoanSource>('spend');
  const [date, setDate] = useState(range.initial);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amt = amount ?? 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    const when = entryDate(state, amt, date, 'কত টাকা ধার দিলে লেখো।', amountRef);
    if (!when) return;
    if (!name.trim()) {
      toast.error('কাকে ধার দিলে লেখো।');
      nameRef.current?.focus();
      return;
    }
    const loan = { id: uid(), date: when, name, amount: amt, from };
    run({ type: 'addLoan', loan }, money(amt) + ' ধার লেখা হয়েছে।');
    setAmount(null);
    setName('');
    if (onDone) onDone();
    else amountRef.current?.focus();
  }

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
          {LOAN_SOURCES.map((o) => (
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
              : 'সঞ্চয় হবে ' + money(Math.max(0, d.savingsHeld - amt)) + '। খরচের টাকা একই থাকবে।'}
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
