import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DailySpendChart } from '@/components/DailySpendChart';
import { NumberInput } from '@/components/NumberInput';
import { Ledger } from '@/components/Ledger';
import { Meter, Panel, PanelTitle } from '@/components/Panel';
import { PageHeader } from '@/components/layout/PageHeader';
import { todayISO } from '@/lib/dates';
import { dayLabel, money, monthLabel } from '@/lib/format';
import { CATEGORIES, canClose, reconRows, savedTotal, type Derived, type Month } from '@/lib/model';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export function ReviewView({ m, d, onCloseMonth }: { m: Month; d: Derived; onCloseMonth: (key: string) => void }) {
  const { state, dispatch } = useStore();
  const keys = Object.keys(state.months).sort();
  const at = keys.indexOf(state.activeMonth);
  const saved = m.saved ?? 0;
  const savedPlan = m.saved ?? m.savingsTarget;
  const left = d.income + d.carry - savedPlan - d.actual;
  const total = Math.max(1, savedPlan + d.actual + Math.max(0, left));
  const pct = (n: number) => (Math.max(0, n) / total) * 100;

  return (
    <>
      <PageHeader title="রিভিউ">
        <div className="flex items-center justify-between rounded-xl border bg-card max-sm:w-full">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="আগের মাস"
            disabled={at <= 0}
            onClick={() => dispatch({ type: 'selectMonth', key: keys[at - 1] })}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium">{monthLabel(state.activeMonth)}</span>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="পরের মাস"
            disabled={at >= keys.length - 1}
            onClick={() => dispatch({ type: 'selectMonth', key: keys[at + 1] })}
          >
            <ChevronRight />
          </Button>
        </div>
      </PageHeader>

      {(canClose(state, state.activeMonth) || m.closed) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          {m.closed ? (
            <>
              <Check className="size-4 text-success" />
              <span className="flex-1">এই মাস বন্ধ করা হয়েছে।</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'reopenMonth' })}>আবার খোলো</Button>
            </>
          ) : (
            <>
              <span className="flex-1">মাস শেষের হিসাব মিলিয়ে বন্ধ করো, তাহলে পরের মাস ঠিক টাকা দিয়ে শুরু হবে।</span>
              <Button size="sm" onClick={() => onCloseMonth(state.activeMonth)}>মাস বন্ধ করো</Button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10">
            <div>
              <div className="text-sm text-muted-foreground">{m.saved == null ? 'সঞ্চয়ের লক্ষ্য' : 'এই মাসে জমলো'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className={cn('font-fig text-4xl font-semibold', m.saved == null ? 'text-foreground' : 'text-success')}>
                  {money(m.saved == null ? m.savingsTarget : saved)}
                </span>
                {m.saved != null && m.savingsTarget > 0 && (
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs',
                    saved >= m.savingsTarget ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning'
                  )}>
                    {saved >= m.savingsTarget ? 'লক্ষ্য পূরণ' : 'লক্ষ্য ' + money(m.savingsTarget)}
                  </span>
                )}
              </div>
              {m.saved == null && (
                <p className="mt-2 text-sm text-muted-foreground">মাস বন্ধ করার সময় আসলে কত জমলো সেটা লেখা হবে।</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">সব মাস মিলিয়ে জমেছে {money(savedTotal(state))}</p>
            </div>
            <div>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-track">
                <div className="bg-success" style={{ width: pct(savedPlan) + '%' }} />
                <div className="bg-muted-foreground/60" style={{ width: pct(d.actual) + '%' }} />
                <div className="bg-[color-mix(in_srgb,var(--primary)_35%,transparent)]" style={{ width: pct(left) + '%' }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure label="আয়" value={money(d.income)} />
                <Figure label="সঞ্চয়" value={money(savedPlan)} dot="var(--success)" />
                <Figure label="খরচ" value={money(d.actual)} dot="color-mix(in srgb, var(--muted-foreground) 60%, transparent)" />
                <Figure label={d.isCurrent ? 'বাকি' : 'থাকল'} value={money(left)} dot="color-mix(in srgb, var(--primary) 35%, transparent)" bad={left < 0} />
              </div>
              {d.carry !== 0 && (
                <p className="mt-3 text-xs text-muted-foreground">আগের মাস থেকে {money(d.carry)} ধরে</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>প্ল্যান বনাম আসল</PanelTitle>
          <div className="grid gap-4">
            {CATEGORIES.map((c) => {
              const cat = d.perCategory[c.key];
              const over = cat.actual - cat.planned;
              return (
                <div key={c.key} style={{ '--tint': c.tint } as CSSProperties}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-[15px]">
                      <span className="size-2.5 rounded-full bg-(--tint)" />
                      {c.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-fig text-[15px] text-foreground">{money(cat.actual)}</span> / {money(cat.planned)}
                    </span>
                  </div>
                  <Meter
                    className="mt-2 h-2"
                    value={cat.planned > 0 ? (cat.actual / cat.planned) * 100 : cat.actual > 0 ? 100 : 0}
                    color={over > 0 ? 'var(--warning)' : c.tint}
                  />
                  <div className={cn('mt-1 text-xs', over > 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {cat.planned === 0 && cat.actual === 0
                      ? 'প্ল্যান নেই'
                      : over > 0 ? money(over) + ' বেশি গেছে' : over < 0 ? money(-over) + ' বেঁচেছে' : 'ঠিক প্ল্যান মতো'}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelTitle>দিনের খরচ</PanelTitle>
          <DailySpendChart m={m} d={d} monthKey={state.activeMonth} />
        </Panel>

        <Reconcile m={m} />

        <Panel>
          <PanelTitle><label htmlFor="reflection">পরের মাসে কী বদলাবে?</label></PanelTitle>
          <Textarea
            id="reflection"
            placeholder="এক লাইনই যথেষ্ট"
            value={m.reflection}
            onChange={(e) => dispatch({ type: 'setReflection', value: e.target.value })}
            className="min-h-24 rounded-xl"
          />
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle>{monthLabel(state.activeMonth)}র সব লেখা</PanelTitle>
          {m.incomes.some((x) => x.date) && (
            <div className="mb-4 rounded-2xl bg-muted px-4 py-2">
              {m.incomes.filter((x) => x.date).map((x) => (
                <div key={x.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="size-2 rounded-full bg-success" />
                  <span className="flex-1">{x.name || 'আয়'}</span>
                  <span className="text-xs text-muted-foreground">{dayLabel(x.date!)}</span>
                  <span className="w-24 text-right font-fig text-success">+{money(x.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <Ledger log={m.log} />
        </Panel>
      </div>
    </>
  );
}

function Figure({ label, value, dot, bad }: { label: string; value: string; dot?: string; bad?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot && <span className="size-2 rounded-sm" style={{ background: dot }} />}
        {label}
      </div>
      <div className={cn('font-fig text-lg font-medium', bad && 'text-danger')}>{value}</div>
    </div>
  );
}

/* Mid-month check: does the cash in hand match the ledger? */
function Reconcile({ m }: { m: Month }) {
  const { state, dispatch } = useStore();
  const [checkAmount, setCheckAmount] = useState<number | null>(null);
  const [checkDate, setCheckDate] = useState(todayISO());
  const amountRef = useRef<HTMLInputElement>(null);
  const rows = reconRows(m);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (checkAmount == null) {
      amountRef.current?.focus();
      return;
    }
    dispatch({ type: 'addCheck', date: checkDate || todayISO(), amount: checkAmount });
    setCheckAmount(null);
    setCheckDate(todayISO());
  }

  function removeCheck(id: string) {
    const month = state.activeMonth;
    const index = m.checks.findIndex((c) => c.id === id);
    const check = m.checks[index];
    dispatch({ type: 'deleteCheck', id });
    undoToast('মিলানো মুছে ফেলা হয়েছে।', () => dispatch({ type: 'restoreCheck', month, check, index }));
  }

  return (
    <Panel>
      <PanelTitle>পকেট মিলাও</PanelTitle>
      <p className="-mt-1 mb-4 text-sm text-muted-foreground">হাতের টাকা আর খাতার হিসাব মিলছে কি না দেখো। যেটুকু ফাঁক, সেটুকু খরচ লেখা হয়নি।</p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <NumberInput
          ref={amountRef}
          nullable
          placeholder="এখন হাতে কত"
          aria-label="এখন হাতে কত"
          value={checkAmount}
          onValue={setCheckAmount}
          className="h-11 min-w-32 flex-1 rounded-xl font-fig"
        />
        <Input
          type="date"
          aria-label="তারিখ"
          value={checkDate}
          onChange={(e) => setCheckDate(e.target.value)}
          className="h-11 w-auto min-w-36 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl">মিলাও</Button>
      </form>

      {m.cashStart == null && (
        <p className="mt-3 text-sm text-muted-foreground">প্ল্যানে মাসের শুরুতে হাতে কত ছিল সেটা বসালেই মেলানো শুরু হবে।</p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 divide-y rounded-2xl border">
          {rows.map(({ check, expected, gap }) => (
            <div key={check.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className="text-sm font-medium">{dayLabel(check.date)}</span>
              <span className="flex-1 text-xs text-muted-foreground">
                হাতে {money(check.amount)}{expected == null ? '' : ' · খাতায় ' + money(expected)}
              </span>
              <span className={cn(
                'text-sm',
                gap == null || gap < 0 ? 'text-muted-foreground' : gap > 0 ? 'text-warning' : 'text-success'
              )}>
                {gap == null
                  ? 'শুরুর টাকা বসাও'
                  : gap > 0
                    ? money(gap) + ' লেখা হয়নি'
                    : gap < 0
                      ? money(Math.abs(gap)) + ' বেশি আছে'
                      : 'মিলে গেছে'}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-danger"
                aria-label="মুছে ফেলো"
                onClick={() => removeCheck(check.id)}
              >
                <X />
              </Button>
              {gap != null && gap > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="basis-full rounded-lg"
                  onClick={() => dispatch({ type: 'fillGap', checkId: check.id })}
                >
                  অজানা খরচ হিসেবে লিখে দাও
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
