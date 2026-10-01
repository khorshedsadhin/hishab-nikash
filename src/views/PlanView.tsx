import { useState, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, LockOpen, Plus, Repeat, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CategoryChart } from '@/components/CategoryChart';
import { KpiCard } from '@/components/KpiCard';
import { NumberInput } from '@/components/NumberInput';
import { prevMonthKey, uid } from '@/lib/dates';
import { money, monthLabel } from '@/lib/format';
import { CATEGORIES, carryInto, type Derived, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export function PlanView({ m, d }: { m: Month; d: Derived }) {
  const { state, dispatch } = useStore();
  const [newLineId, setNewLineId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const locked = m.locked;
  const nudge = !locked && !d.isFuture;

  return (
    <div className="grid gap-4 md:gap-6">
      <div className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm',
        nudge && 'border-danger/40 bg-danger/10'
      )}>
        {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
        {locked ? 'প্ল্যান লক করা আছে' : nudge ? 'মাস শুরু হয়ে গেছে — প্ল্যান লক করে দাও' : 'প্ল্যান এখনো খোলা'}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => (locked ? setAsking(true) : dispatch({ type: 'setLocked', value: true }))}
        >
          {locked ? 'আনলক করো' : 'লক করো'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="gap-2 px-5 py-4">
          <label htmlFor="income" className="text-sm text-muted-foreground">মাসের আয়</label>
          <NumberInput id="income" value={m.income} disabled={locked} onValue={(v) => dispatch({ type: 'setIncome', value: v ?? 0 })} className="font-fig text-lg" />
        </Card>
        <Card className="gap-2 px-5 py-4">
          <label htmlFor="savings" className="text-sm text-muted-foreground">যা সরিয়ে রাখবে</label>
          <NumberInput id="savings" value={m.savingsTarget} disabled={locked} onValue={(v) => dispatch({ type: 'setSavingsTarget', value: v ?? 0 })} className="font-fig text-lg" />
        </Card>
        <Card className="gap-2 px-5 py-4">
          <label htmlFor="cash-start" className="text-sm text-muted-foreground">মাসের শুরুতে হাতে ছিল</label>
          <NumberInput
            id="cash-start"
            nullable
            value={m.cashStart}
            disabled={locked}
            placeholder={String(carryInto(state, state.activeMonth))}
            onValue={(v) => dispatch({ type: 'setCashStart', value: v })}
            className="font-fig text-lg"
          />
        </Card>
        <KpiCard label="খরচযোগ্য" value={<span className="text-primary">{money(d.spendable)}</span>} />
      </div>

      {m.cashStart == null && d.carry !== 0 && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
          d.carry < 0 ? 'border-danger/40 bg-danger/10' : 'border-success/40 bg-success/10'
        )}>
          {d.carry < 0 ? <ArrowDownRight className="size-4 text-danger" /> : <ArrowUpRight className="size-4 text-success" />}
          {monthLabel(prevMonthKey(state.activeMonth))} থেকে{' '}
          {d.carry < 0 ? money(Math.abs(d.carry)) + ' ঘাটতি এই মাসে যোগ হয়েছে' : money(d.carry) + ' বেঁচে এসেছে'}
        </div>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-4 md:gap-6 lg:col-span-2 2xl:grid-cols-2">
          {CATEGORIES.map((c) => {
            const cat = d.perCategory[c.key];
            const pct = cat.planned > 0 ? Math.min(100, cat.actual / cat.planned * 100) : 0;
            const over = cat.actual > cat.planned;
            return (
              <Card key={c.key} className="gap-0 overflow-hidden py-0" style={{ '--ca': c.tint } as CSSProperties}>
                <div className="border-b bg-[color-mix(in_srgb,var(--ca)_10%,transparent)] px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-semibold">
                      <span className="size-2.5 rounded-full bg-(--ca)" />
                      {c.label}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      <b className="font-fig text-lg font-normal text-foreground">{money(cat.actual)}</b> / {money(cat.planned)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ca)_20%,transparent)]">
                    <div className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-(--ca)')} style={{ width: pct + '%' }} />
                  </div>
                </div>

                <div className="divide-y">
                  {(m.budget[c.key] || []).map((l) => {
                    const spent = d.lineActual[l.id] || 0;
                    return (
                      <div key={l.id} className="flex items-center gap-1.5 px-2 py-1">
                        <Input
                          value={l.name}
                          placeholder="কীসের খরচ"
                          disabled={locked}
                          autoFocus={l.id === newLineId}
                          onChange={(e) => dispatch({ type: 'updateLine', cat: c.key, id: l.id, name: e.target.value })}
                          className="h-8 min-w-0 flex-1 basis-0 border-transparent bg-transparent shadow-none focus-visible:border-(--ca) dark:bg-transparent"
                        />
                        <div className="ml-auto flex items-center gap-1.5">
                          {spent > 0 && (
                            <span className={cn('shrink-0 font-fig text-xs whitespace-nowrap', spent > l.amount ? 'text-danger' : 'text-muted-foreground')}>
                              {money(spent)} খরচ
                            </span>
                          )}
                          <NumberInput
                            value={l.amount}
                            disabled={locked}
                            onValue={(v) => dispatch({ type: 'updateLine', cat: c.key, id: l.id, amount: v ?? 0 })}
                            aria-label="টাকা"
                            className="h-8 w-20 shrink-0 border-transparent bg-transparent text-right font-fig shadow-none focus-visible:border-(--ca) dark:bg-transparent"
                          />
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => dispatch({ type: 'toggleRepeat', cat: c.key, id: l.id })}
                            className={cn(
                              'flex w-24 shrink-0 items-center justify-center gap-1 rounded-full border py-0.5 text-xs whitespace-nowrap',
                              l.repeat
                                ? 'border-(--ca) bg-[color-mix(in_srgb,var(--ca)_16%,transparent)] text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {l.repeat && <Repeat className="size-3" />}
                            {l.repeat ? 'প্রতি মাসে' : 'এই মাসে'}
                          </button>
                          {!locked && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground hover:text-danger"
                              aria-label="মুছে ফেলো"
                              onClick={() => dispatch({ type: 'deleteLine', cat: c.key, id: l.id })}
                            >
                              <X />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {cat.unlinked > 0 && (
                    <p className="px-5 py-2 text-sm text-muted-foreground">
                      লাইন ছাড়া <b className="font-fig font-normal text-foreground">{money(cat.unlinked)}</b>
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
                      className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      লাইন যোগ করো
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid content-start gap-4 md:gap-6">
          <Card className="gap-1 px-5 py-4">
            <span className="text-sm text-muted-foreground">
              {d.buffer < 0 ? 'প্ল্যান বাজেট ছাড়িয়ে গেছে' : 'প্ল্যানের পরেও হাতে থাকে'}
            </span>
            <span className={cn('font-fig text-4xl leading-tight', d.buffer < 0 ? 'text-danger' : 'text-success')}>
              {money(d.buffer)}
            </span>
            <span className="text-xs font-light text-muted-foreground">
              {money(d.spendable)} খরচযোগ্য − {money(d.planned)} প্ল্যান · পরের মাসে ফিরবে {money(d.repeating)}
              {d.carry ? (m.cashStart != null ? ' · শুরুতে হাতে ' : ' · আগের মাস থেকে ') + money(d.carry) : ''}
            </span>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>খাত অনুযায়ী</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart d={d} />
            </CardContent>
          </Card>
        </div>
      </div>

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
    </div>
  );
}
