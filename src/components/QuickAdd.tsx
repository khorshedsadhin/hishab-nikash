import { useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pad, todayISO } from '@/lib/dates';
import { monthLabel } from '@/lib/format';
import { CATEGORIES, type Derived, type Month } from '@/lib/model';
import { useStore } from '@/state/store';

/* Radix Select can't hold an empty value, so "not in the plan" gets a sentinel. */
const NEW = '__new';

export function QuickAdd({ m, d }: { m: Month; d: Derived }) {
  const { state, dispatch } = useStore();
  const monthStart = state.activeMonth + '-01';
  const monthEnd = state.activeMonth + '-' + pad(d.dim);
  const defaultDate = d.isCurrent ? todayISO() : monthStart;

  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>(CATEGORIES[0].key);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(defaultDate);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /* Spending picks a line the plan already names; free text is the fallback. */
  const lines = (m.budget[cat] || []).filter((l) => l.name.trim());
  const pickValue = lines.some((l) => l.id === pick) || pick === NEW ? pick : (lines[0]?.id ?? NEW);
  const showName = pickValue === NEW;

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      amountRef.current?.focus();
      return;
    }
    const when = date || todayISO();
    if (!state.months[when.slice(0, 7)]) {
      toast.error(monthLabel(when.slice(0, 7)) + ' এখনো খোলা হয়নি। মাস ট্যাব থেকে খুলে নাও।');
      return;
    }
    dispatch({ type: 'addSpend', date: when, cat, amount: amt, pick: showName ? '' : pickValue, name: showName ? name : '' });
    setAmount('');
    setCat(CATEGORIES[0].key);
    setPick('');
    setName('');
    setDate(defaultDate);
    amountRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-[7rem_1fr] gap-2">
      <Input
        ref={amountRef}
        type="number"
        inputMode="numeric"
        placeholder="কত"
        aria-label="কত টাকা"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-11 text-center font-fig text-xl"
      />
      <Select value={cat} onValueChange={(v) => { setCat(v); setPick(''); setName(''); }}>
        <SelectTrigger aria-label="খাত" className="h-11! w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              <span className="size-2 rounded-full" style={{ background: c.tint }} />
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={pickValue}
        onValueChange={(v) => {
          setPick(v);
          if (v === NEW) setTimeout(() => nameRef.current?.focus());
          else setName('');
        }}
      >
        <SelectTrigger aria-label="কীসে খরচ" className="col-span-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          <SelectItem value={NEW}>প্ল্যানে নেই, নতুন খরচ</SelectItem>
        </SelectContent>
      </Select>
      {showName && (
        <Input
          ref={nameRef}
          placeholder="কীসে খরচ"
          aria-label="কীসে খরচ"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2"
        />
      )}
      <Input
        type="date"
        aria-label="তারিখ"
        value={date}
        min={monthStart}
        max={monthEnd}
        onChange={(e) => setDate(e.target.value)}
        className="col-span-2"
      />
      <Button type="submit" size="lg" className="col-span-2 text-base font-semibold">
        <Plus />
        লিখে রাখো
      </Button>
    </form>
  );
}
