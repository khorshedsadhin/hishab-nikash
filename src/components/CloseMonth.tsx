import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { nextMonthKey } from '@/lib/dates';
import { dayLabel, money, monthLabel, toBn } from '@/lib/format';
import {
  bookBalance, CATEGORIES, catLabel, closeDate, deriveMonth, incomeTotal, type Month
} from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';
import { NumberInput } from './NumberInput';

const STEPS = ['সঞ্চয়', 'হাতের টাকা', 'সারাংশ', 'পরের মাস'];

/* Month-end close: savings, a cash count, a short review, then the next month's start. */
export function CloseMonth({ monthKey, onClose, onDone }: { monthKey: string | null; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={monthKey != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto rounded-3xl bg-card p-5 sm:max-w-lg md:p-6">
        {monthKey && <Steps key={monthKey} monthKey={monthKey} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function Steps({ monthKey, onDone }: { monthKey: string; onDone: () => void }) {
  const { state, dispatch } = useStore();
  const m = state.months[monthKey];
  const d = deriveMonth(state, monthKey);
  const nextKey = nextMonthKey(monthKey);
  const next: Month | undefined = state.months[nextKey];

  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<number>(m.saved ?? m.savingsTarget);
  const [cash, setCash] = useState<number | null>(null);
  const [fill, setFill] = useState(true);
  const [extra, setExtra] = useState(0);
  const [reflection, setReflection] = useState(m.reflection);
  const [nextTarget, setNextTarget] = useState<number>(next && next.locked ? next.savingsTarget : (next?.savingsTarget ?? m.savingsTarget));

  const at = closeDate(monthKey);
  const book = bookBalance(state, monthKey, saved);
  const gap = cash == null ? 0 : book - cash;
  const fillGap = cash != null && gap > 0 && fill ? gap : 0;
  const extraSafe = cash == null ? 0 : Math.max(0, Math.min(extra, cash));
  const forward = cash == null ? book : cash - extraSafe;
  const nextIncome = next ? incomeTotal(next) : m.incomes.filter((x) => x.repeat).reduce((s, x) => s + x.amount, 0);
  const nextCommitted = next
    ? CATEGORIES.reduce((s, c) => s + next.budget[c.key].filter((l) => l.repeat).reduce((t, l) => t + l.amount, 0), 0)
    : CATEGORIES.reduce((s, c) => s + m.budget[c.key].filter((l) => l.repeat).reduce((t, l) => t + l.amount, 0), 0);
  const overs = CATEGORIES
    .map((c) => ({ key: c.key, over: d.perCategory[c.key].actual - d.perCategory[c.key].planned, planned: d.perCategory[c.key].planned }))
    .filter((x) => x.planned > 0 && x.over > 0);

  function finish() {
    dispatch({
      type: 'closeMonth',
      month: monthKey,
      saved: saved + extraSafe,
      cash: cash == null ? null : forward,
      forward,
      fillGap,
      reflection,
      nextSavingsTarget: nextTarget
    });
    toast.success(monthLabel(monthKey) + ' বন্ধ হয়েছে। ' + monthLabel(nextKey) + ' শুরু।');
    onDone();
  }

  return (
    <>
      <div>
        <DialogTitle className="font-fig text-xl">{monthLabel(monthKey)} বন্ধ করো</DialogTitle>
        <DialogDescription className="mt-1">মাসের শেষ হিসাব মিলিয়ে পরের মাস শুরু করো।</DialogDescription>
        <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="ধাপ">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className="grid gap-1.5">
              <span className={cn('h-1 rounded-full', i <= step ? 'bg-primary' : 'bg-track')} />
              <span className={cn('text-[11px]', i === step ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <div className="grid gap-3">
          <label htmlFor="close-saved" className="text-[15px] font-medium">এই মাসে আসলে কত সঞ্চয়ে সরিয়েছ?</label>
          <NumberInput
            id="close-saved"
            value={saved}
            onValue={(v) => setSaved(v ?? 0)}
            className="h-12 rounded-xl font-fig text-xl"
          />
          <p className="text-sm text-muted-foreground">লক্ষ্য ছিল {money(m.savingsTarget)}। যা সত্যি আলাদা করেছ সেটাই লেখো।</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3">
          <label htmlFor="close-cash" className="text-[15px] font-medium">
            {dayLabel(at)} এ হাতে আর অ্যাকাউন্টে খরচের টাকা কত আছে?
          </label>
          <NumberInput
            id="close-cash"
            nullable
            value={cash}
            placeholder={String(Math.max(0, book))}
            onValue={setCash}
            className="h-12 rounded-xl font-fig text-xl"
          />
          <p className="text-sm text-muted-foreground">সঞ্চয়ের টাকা বাদে গুনে লেখো। খাতা অনুযায়ী থাকার কথা {money(book)}।</p>

          {cash != null && (
            <div className={cn(
              'rounded-2xl border px-4 py-3 text-sm',
              gap > 0 ? 'border-warning/40 bg-warning/8' : gap < 0 ? 'border-border bg-muted' : 'border-success/40 bg-success/8'
            )}>
              {gap === 0 && <span className="flex items-center gap-2 text-success"><Check className="size-4" />মিলে গেছে।</span>}
              {gap > 0 && (
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="mt-1 size-4 accent-(--primary)" />
                  <span>
                    <b className="font-medium text-warning">{money(gap)}</b> খরচ লেখা হয়নি। অজানা খরচ হিসেবে লিখে দাও।
                  </span>
                </label>
              )}
              {gap < 0 && <span>{money(-gap)} বেশি আছে। কোনো আয় লেখা বাকি থাকতে পারে, সেটা আয় হিসেবে লিখে নিতে পারো।</span>}
            </div>
          )}

          {cash != null && cash > 0 && (
            <div className="grid gap-2">
              <span className="text-[15px] font-medium">বাকি {money(cash)} দিয়ে কী করবে?</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'সবটা পরের মাসে', value: 0 },
                  { label: 'অর্ধেক সঞ্চয়ে', value: Math.round(cash / 2) },
                  { label: 'সবটা সঞ্চয়ে', value: cash }
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={extra === o.value}
                    onClick={() => setExtra(o.value)}
                    className={cn(
                      'min-h-9 rounded-full border px-3.5 text-sm',
                      extra === o.value ? 'border-primary bg-primary/12 text-foreground' : 'border-input text-muted-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {cash == null && <p className="text-xs text-muted-foreground">গুনে না দেখলে খালি রাখো, খাতার হিসাবই পরের মাসে যাবে।</p>}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="আয়" value={money(d.received)} />
            <Stat label="সঞ্চয়" value={money(saved + extraSafe)} tone={saved + extraSafe >= m.savingsTarget ? 'good' : 'warn'} />
            <Stat label="খরচ" value={money(d.actual + fillGap)} />
            <Stat label="পরের মাসে যাবে" value={money(forward)} />
          </div>
          {overs.length > 0 ? (
            <div className="text-sm">
              <div className="mb-1 text-muted-foreground">প্ল্যানের বাইরে গেছে</div>
              {overs.map((o) => (
                <div key={o.key} className="flex justify-between py-1">
                  <span>{catLabel(o.key)}</span>
                  <span className="font-fig text-warning">{money(o.over)} বেশি</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-success">সব খাত প্ল্যানের মধ্যে ছিল।</p>
          )}
          <label className="grid gap-2">
            <span className="text-[15px] font-medium">পরের মাসে কী বদলাবে?</span>
            <Textarea
              value={reflection}
              placeholder="এক লাইনই যথেষ্ট"
              onChange={(e) => setReflection(e.target.value)}
              className="min-h-20 rounded-xl"
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 text-sm">
          <p className="text-[15px] font-medium">{monthLabel(nextKey)} যেভাবে শুরু হবে</p>
          <Row label={next ? 'প্ল্যানে ধরা আয়' : 'প্রতি মাসের আয়'} value={money(nextIncome)} />
          <Row label="আগের মাস থেকে" value={money(forward)} />
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">সঞ্চয়ের লক্ষ্য</span>
            <NumberInput
              value={nextTarget}
              disabled={next?.locked}
              onValue={(v) => setNextTarget(v ?? 0)}
              aria-label="পরের মাসের সঞ্চয়ের লক্ষ্য"
              className="h-10 w-32 rounded-xl text-right font-fig"
            />
          </label>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">খরচযোগ্য</span>
            <span className="font-fig text-2xl font-semibold text-primary">{money(nextIncome + forward - nextTarget)}</span>
          </div>
          <p className="text-muted-foreground">
            এর মধ্যে {money(nextCommitted)} প্রতি মাসের বাঁধা খরচ, প্ল্যানে আগে থেকেই থাকবে।
            {nextIncome === 0 && ' আয় এখনো কিছু ধরা নেই, প্ল্যানে গিয়ে আয় যোগ করো।'}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setStep(step - 1)} aria-label="আগের ধাপ">
            <ArrowLeft />
          </Button>
        )}
        {step < 3 ? (
          <Button className="h-11 flex-1 rounded-xl font-fig text-base font-semibold" onClick={() => setStep(step + 1)}>
            পরের ধাপ · {toBn(step + 2)}/{toBn(4)}
          </Button>
        ) : (
          <Button className="h-11 flex-1 rounded-xl font-fig text-base font-semibold" onClick={finish}>
            বন্ধ করে {monthLabel(nextKey)} শুরু করো
          </Button>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-2xl bg-muted px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('font-fig text-lg font-semibold', tone === 'good' && 'text-success', tone === 'warn' && 'text-warning')}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-fig text-base">{value}</span>
    </div>
  );
}
