import { useState, type CSSProperties } from 'react';
import { Lock, LockOpen, Plus, Repeat, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/NumberInput';
import { Meter, Panel, PanelTitle } from '@/components/Panel';
import { MonthPicker, PageHeader } from '@/components/layout/PageHeader';
import { prevMonthKey, todayISO, uid } from '@/lib/dates';
import { dayLabel, money, monthLabel, toBn } from '@/lib/format';
import { CATEGORIES, carryInto, type Derived, type Income, type Month } from '@/lib/model';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

const ghostInput = 'h-9 border-transparent bg-transparent shadow-none focus-visible:border-input dark:bg-transparent';

export function PlanView({ m, d }: { m: Month; d: Derived }) {
  const { state, dispatch } = useStore();
  const [newLineId, setNewLineId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const locked = m.locked;
  const nudge = !locked && !d.isFuture && !m.closed;
  const share = (n: number) => (d.spendable > 0 ? (n / d.spendable) * 100 : 0);

  return (
    <>
      <PageHeader title="প্ল্যান" sub={monthLabel(state.activeMonth)}>
        <Button
          variant="outline"
          className={cn('h-10 rounded-xl bg-card', nudge && 'border-warning/60 text-warning')}
          onClick={() => (locked ? setAsking(true) : dispatch({ type: 'setLocked', value: true }))}
        >
          {locked ? <Lock className="text-primary" /> : <LockOpen />}
          {locked ? 'লক করা' : 'লক করো'}
        </Button>
        <MonthPicker />
      </PageHeader>

      {nudge && (
        <p className="-mt-2 mb-5 text-sm text-warning">মাস শুরু হয়ে গেছে। প্ল্যান ঠিক হলে লক করে দাও, তাহলে মাঝপথে বদলাবে না।</p>
      )}
      {m.closed && <p className="-mt-2 mb-5 text-sm text-muted-foreground">এই মাস বন্ধ করা হয়েছে।</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
            <Incomes m={m} d={d} />

            <div className="grid content-start gap-3 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
              <SumRow label="মোট আয়" value={money(d.income)} />
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">সঞ্চয়ে সরাবে</span>
                <span className="flex items-center gap-1 font-fig">
                  −
                  <NumberInput
                    value={m.savingsTarget}
                    disabled={locked}
                    onValue={(v) => dispatch({ type: 'setSavingsTarget', value: v ?? 0 })}
                    aria-label="সঞ্চয়ে সরাবে"
                    className="h-9 w-28 rounded-lg text-right font-fig"
                  />
                </span>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {monthLabel(prevMonthKey(state.activeMonth))} থেকে
                  <span className="block text-xs">শুরুতে হাতে থাকা খরচের টাকা</span>
                </span>
                <NumberInput
                  nullable
                  value={m.cashStart}
                  disabled={locked}
                  placeholder={String(carryInto(state, state.activeMonth))}
                  onValue={(v) => dispatch({ type: 'setCashStart', value: v })}
                  aria-label="শুরুতে হাতে ছিল"
                  className="h-9 w-28 rounded-lg text-right font-fig"
                />
              </label>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-medium">খরচযোগ্য</span>
                <span className={cn('font-fig text-3xl font-semibold', d.spendable < 0 ? 'text-danger' : 'text-primary')}>
                  {money(d.spendable)}
                </span>
              </div>

              <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-track">
                {CATEGORIES.map((c) => (
                  <div key={c.key} style={{ width: share(d.perCategory[c.key].planned) + '%', background: c.tint }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {CATEGORIES.map((c) => (
                  <span key={c.key} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: c.tint }} />
                    {c.label} {toBn(Math.round(share(d.perCategory[c.key].planned)))}%
                  </span>
                ))}
              </div>
              <p className={cn('text-sm', d.buffer < 0 ? 'text-danger' : 'text-muted-foreground')}>
                {d.buffer < 0
                  ? 'প্ল্যান খরচযোগ্যের চেয়ে ' + money(-d.buffer) + ' বেশি। কোনো খাত কমাও।'
                  : d.buffer > 0
                    ? money(d.buffer) + ' এখনো কোনো খাতে ভাগ হয়নি।'
                    : 'সব টাকা খাতে ভাগ হয়ে গেছে।'}
              </p>
            </div>
          </div>
        </Panel>

        {CATEGORIES.map((c) => {
          const cat = d.perCategory[c.key];
          return (
            <Panel key={c.key} className="overflow-hidden p-0 md:p-0" style={{ '--tint': c.tint } as CSSProperties}>
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_14%,transparent)]">
                  <span className="size-2.5 rounded-full bg-(--tint)" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{c.label}</h2>
                  <div className="text-xs text-muted-foreground">খরচ {money(cat.actual)}</div>
                </div>
                <span className={cn('font-fig text-xl font-semibold', cat.actual > cat.planned && cat.planned > 0 && 'text-danger')}>
                  {money(cat.planned)}
                </span>
              </div>

              {(m.budget[c.key] || []).map((l) => {
                const spent = d.lineActual[l.id] || 0;
                return (
                  <div key={l.id} className="border-t px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={l.name}
                        placeholder="কীসের খরচ"
                        disabled={locked}
                        autoFocus={l.id === newLineId}
                        onChange={(e) => dispatch({ type: 'updateLine', cat: c.key, id: l.id, name: e.target.value })}
                        className={cn(ghostInput, 'min-w-0 flex-1 basis-0')}
                      />
                      <button
                        type="button"
                        disabled={locked}
                        aria-pressed={l.repeat}
                        title={l.repeat ? 'প্রতি মাসে আসে' : 'শুধু এই মাসে'}
                        aria-label={l.repeat ? 'প্রতি মাসে আসে' : 'শুধু এই মাসে'}
                        onClick={() => dispatch({ type: 'toggleRepeat', cat: c.key, id: l.id })}
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          l.repeat ? 'text-(--tint)' : 'text-muted-foreground/40 hover:text-muted-foreground'
                        )}
                      >
                        <Repeat className="size-4" />
                      </button>
                      <NumberInput
                        value={l.amount}
                        disabled={locked}
                        onValue={(v) => dispatch({ type: 'updateLine', cat: c.key, id: l.id, amount: v ?? 0 })}
                        aria-label="টাকা"
                        className={cn(ghostInput, 'w-24 shrink-0 text-right font-fig')}
                      />
                      {!locked && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-danger"
                          aria-label="মুছে ফেলো"
                          onClick={() => {
                            const month = state.activeMonth;
                            const index = m.budget[c.key].indexOf(l);
                            dispatch({ type: 'deleteLine', cat: c.key, id: l.id });
                            undoToast('লাইন মুছে ফেলা হয়েছে।', () =>
                              dispatch({ type: 'restoreLine', month, cat: c.key, line: l, index })
                            );
                          }}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 px-3 pb-1">
                      <Meter className="h-1 flex-1" value={l.amount > 0 ? (spent / l.amount) * 100 : 0} color={spent > l.amount ? 'var(--danger)' : c.tint} />
                      <span className={cn('min-w-24 text-right text-xs', spent > l.amount ? 'text-danger' : 'text-muted-foreground')}>
                        {spent > 0 ? money(spent) + ' খরচ' : l.repeat ? 'এখনো দেওয়া হয়নি' : 'খরচ হয়নি'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {cat.unlinked > 0 && (
                <p className="border-t px-5 py-2.5 text-sm text-muted-foreground">
                  লাইন ছাড়া খরচ <b className="font-fig font-normal text-foreground">{money(cat.unlinked)}</b>
                </p>
              )}
              {!locked && (
                <button
                  type="button"
                  onClick={() => {
                    const id = uid();
                    setNewLineId(id);
                    dispatch({ type: 'addLine', cat: c.key, id });
                  }}
                  className="flex min-h-12 w-full items-center gap-2 border-t px-5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  <Plus className="size-4" />
                  লাইন যোগ করো
                </button>
              )}
            </Panel>
          );
        })}
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Repeat className="size-3.5" />
        চিহ্ন দেওয়া লাইন প্রতি মাসের বাঁধা খরচ, পরের মাসেও আপনা থেকে আসবে।
      </p>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>প্ল্যান আনলক করবে?</AlertDialogTitle>
            <AlertDialogDescription>
              মাস চলাকালীন প্ল্যান বদলালে হিসাব আর প্ল্যানের সাথে মিলবে না। সত্যিই দরকার হলে বদলাও।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction onClick={() => dispatch({ type: 'setLocked', value: false })}>
              হ্যাঁ, আনলক করো
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-fig text-lg">{value}</span>
    </div>
  );
}

/* Income lines: expected ones wait for a tap when the money actually arrives. */
function Incomes({ m, d }: { m: Month; d: Derived }) {
  const { state, dispatch } = useStore();
  const [newId, setNewId] = useState<string | null>(null);
  const arrivalDate = () => {
    const today = todayISO();
    const first = state.activeMonth + '-01';
    return today.slice(0, 7) === state.activeMonth ? today : first;
  };

  function remove(x: Income) {
    const month = state.activeMonth;
    const index = m.incomes.indexOf(x);
    dispatch({ type: 'deleteIncome', id: x.id });
    undoToast('আয় মুছে ফেলা হয়েছে।', () => dispatch({ type: 'restoreIncome', month, income: x, index }));
  }

  return (
    <div>
      <PanelTitle action={<span className="text-sm text-muted-foreground">এসেছে {money(d.received)}</span>}>আয়</PanelTitle>
      {m.incomes.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">এই মাসে কোথা থেকে কত আসবে লেখো। বেতন, প্রজেক্ট, যেকোনো আয়।</p>
      )}
      <div className="divide-y">
        {m.incomes.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-1 py-1.5">
            <Input
              value={x.name}
              placeholder="কোথা থেকে"
              autoFocus={x.id === newId}
              onChange={(e) => dispatch({ type: 'updateIncome', id: x.id, name: e.target.value })}
              className={cn(ghostInput, 'min-w-28 flex-1 basis-0 px-2')}
            />
            <button
              type="button"
              aria-pressed={x.repeat}
              title={x.repeat ? 'প্রতি মাসে আসে' : 'শুধু এই মাসে'}
              aria-label={x.repeat ? 'প্রতি মাসে আসে' : 'শুধু এই মাসে'}
              onClick={() => dispatch({ type: 'toggleIncomeRepeat', id: x.id })}
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                x.repeat ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'
              )}
            >
              <Repeat className="size-4" />
            </button>
            <NumberInput
              value={x.amount}
              onValue={(v) => dispatch({ type: 'updateIncome', id: x.id, amount: v ?? 0 })}
              aria-label="টাকা"
              className={cn(ghostInput, 'w-24 shrink-0 text-right font-fig')}
            />
            {x.date ? (
              <button
                type="button"
                title="আসেনি হিসেবে ফেরাও"
                onClick={() => dispatch({ type: 'receiveIncome', id: x.id, date: null })}
                className="min-h-8 w-24 shrink-0 rounded-full bg-success/12 px-2 text-xs text-success"
              >
                এসেছে {dayLabel(x.date).split(' ')[0]}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'receiveIncome', id: x.id, date: arrivalDate() })}
                className="min-h-8 w-24 shrink-0 rounded-full border border-dashed border-input px-2 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                আসবে · এলো?
              </button>
            )}
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" aria-label="মুছে ফেলো" onClick={() => remove(x)}>
              <X />
            </Button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const id = uid();
          setNewId(id);
          dispatch({ type: 'addIncome', id, name: '', amount: 0, date: null, repeat: false, toSavings: 0 });
        }}
        className="mt-1 flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
        আয় যোগ করো
      </button>
    </div>
  );
}
