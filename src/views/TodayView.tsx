import type { ReactNode } from 'react';
import { CalendarCheck2, CalendarX, Check, ChevronRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntryForm, type EntryMode } from '@/components/EntryForm';
import { Envelopes } from '@/components/Envelopes';
import { Ledger } from '@/components/Ledger';
import { Panel, PanelTitle } from '@/components/Panel';
import { WeekCard } from '@/components/WeekCard';
import { MonthPicker, PageHeader } from '@/components/layout/PageHeader';
import type { View } from '@/components/layout/nav';
import { prevMonthKey, todayISO, weekdayOf } from '@/lib/dates';
import { BN_WEEKDAYS_LONG, dayLabel, money, monthLabel, toBn } from '@/lib/format';
import { canClose, headline, isBlank, streak, type Derived, type Month, type Week } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export function TodayView({ m, d, mode, onMode, onCloseMonth, onView, onAdd }: {
  m: Month;
  d: Derived;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onCloseMonth: (key: string) => void;
  onView: (v: View) => void;
  onAdd: () => void;
}) {
  const { state, dispatch } = useStore();
  const today = todayISO();
  const current = today.slice(0, 7);
  const s = streak(state);
  /* Only warnings about money that is actually short; the month's pace is not shown. */
  const warn = d.isCurrent && (d.remaining <= 0 || d.safeRemaining <= 0 || (d.week != null && d.week.left < 0));
  const blank = isBlank(m);
  const showZeroDay = d.isCurrent && !(m.loggedDays || []).includes(today);
  const closeKey = canClose(state, state.activeMonth)
    ? state.activeMonth
    : d.isCurrent && canClose(state, prevMonthKey(state.activeMonth)) ? prevMonthKey(state.activeMonth) : null;

  return (
    <>
      <PageHeader title="আজ" sub={BN_WEEKDAYS_LONG[weekdayOf(today)] + ', ' + dayLabel(today)}>
        <MonthPicker />
      </PageHeader>

      {state.activeMonth !== current && state.months[current] && (
        <Notice icon={<History className="size-5 text-muted-foreground" />}>
          <span>তুমি <b className="font-medium">{monthLabel(state.activeMonth)}</b> দেখছো।</span>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => dispatch({ type: 'selectMonth', key: current })}>
            {monthLabel(current)}-এ ফেরো
          </Button>
        </Notice>
      )}

      {closeKey && (
        <Notice tone="primary" icon={<CalendarCheck2 className="size-5 text-primary" />}>
          <span><b className="font-medium">{monthLabel(closeKey)}</b> বন্ধ করা বাকি। হাতের টাকা মিলিয়ে পরের মাস শুরু করো।</span>
          <Button size="sm" className="rounded-lg" onClick={() => onCloseMonth(closeKey)}>বন্ধ করো</Button>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          {(blank || !m.locked) && !m.closed && <Setup m={m} d={d} full={blank} onPlan={() => onView('plan')} onAdd={onAdd} />}

          {!blank && (
            <>
              <div className="grid gap-3 md:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Panel>
                {d.week ? <WeekCard d={d as Derived & { week: Week }} /> : <MonthHero d={d} />}
                {warn && (
                  <p className={cn('mt-4 border-t pt-4 text-sm', d.remaining <= 0 ? 'text-danger' : 'text-warning')}>{headline(d)}</p>
                )}
              </Panel>

              {d.isCurrent && <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-1">
                <Tile
                  label="মাসে বাকি"
                  value={money(d.remaining)}
                  tone={d.remaining < 0 ? 'bad' : undefined}
                  sub={money(d.spendable) + ' এর মধ্যে · ' + toBn(d.daysLeft) + ' দিন বাকি'}
                />
                <Tile
                  label="বাঁধা খরচ বাকি"
                  value={money(d.committedLeft)}
                  sub={d.committedLeft > 0 ? 'প্রতি মাসের লাইনে এখনো দেওয়া বাকি' : 'সব বাঁধা খরচ দেওয়া হয়ে গেছে'}
                />
              </div>}
              </div>

              <Panel>
                <PanelTitle>খাত</PanelTitle>
                <Envelopes d={d} />
              </Panel>
            </>
          )}

          <Panel>
            <PanelTitle
              action={m.log.length > 0 && (
                <button
                  type="button"
                  onClick={() => onView('review')}
                  className="-mr-2 flex min-h-9 items-center gap-0.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  সব দেখো
                  <ChevronRight className="size-4" />
                </button>
              )}
            >
              সাম্প্রতিক
            </PanelTitle>
            {m.log.length > 0 && (
              <p className={cn('-mt-2 mb-3 text-xs', s.warn ? 'text-warning' : 'text-muted-foreground')}>{s.text}</p>
            )}
            {showZeroDay && (
              <Button
                variant="outline"
                className="mb-3 h-11 w-full rounded-xl border-dashed text-muted-foreground hover:border-success hover:text-success"
                onClick={() => dispatch({ type: 'markZeroDay' })}
              >
                <CalendarX />
                আজ কিছু খরচ হয়নি
              </Button>
            )}
            <Ledger log={m.log} days={5} />
          </Panel>
        </div>

        {/* The form stays in view while the left column scrolls. */}
        <div className="hidden content-start lg:sticky lg:top-8 lg:grid lg:self-start">
          <Panel>
            <PanelTitle>লেখো</PanelTitle>
            <EntryForm key={state.activeMonth} m={m} d={d} mode={mode} onMode={onMode} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Notice({ icon, tone, children }: { icon: ReactNode; tone?: 'primary'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-sm [&>span]:min-w-0 [&>span]:flex-1',
        tone === 'primary' ? 'border-primary/40 bg-primary/8' : 'bg-card'
      )}
    >
      <span className="contents">{icon}</span>
      {children}
    </div>
  );
}

/* The three things a month needs before daily logging makes sense. */
function Setup({ m, d, full, onPlan, onAdd }: { m: Month; d: Derived; full: boolean; onPlan: () => void; onAdd: () => void }) {
  const { state } = useStore();
  const steps = [
    { done: d.income > 0, title: 'মাসের আয় লেখো', body: 'বেতন বা যা আসবে, আগে থেকেই ধরে রাখো।' },
    { done: d.planned > 0, title: 'খাতে টাকা ভাগ করো', body: 'ভাড়া, বাজার, বিল, কোন খাতে কত যাবে।' },
    { done: m.locked, title: 'প্ল্যান লক করো', body: 'তাহলে মাঝপথে প্ল্যান বদলে যাবে না।' }
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <Panel className={cn(!full && 'py-4 md:py-5')}>
      {full && (
        <div className="mb-5">
          <h2 className="font-fig text-2xl font-semibold">হিসাব শুরু করো</h2>
          <p className="mt-1 text-muted-foreground">তিন ধাপে {monthLabel(state.activeMonth)}-এর প্ল্যান বানাও। তারপর প্রতিদিন শুধু খরচ লিখলেই হবে।</p>
        </div>
      )}
      {!full && <PanelTitle className="mb-2">প্ল্যান শেষ করো</PanelTitle>}
      <ol className="grid gap-1">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={onPlan}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/60',
                i === next && 'bg-muted/60'
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full font-fig text-sm font-semibold',
                  s.done ? 'bg-success/15 text-success' : i === next ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground'
                )}
              >
                {s.done ? <Check className="size-4" /> : toBn(i + 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-medium', s.done && 'text-muted-foreground line-through decoration-1')}>{s.title}</span>
                {(full || i === next) && <span className="block text-sm text-muted-foreground">{s.body}</span>}
              </span>
              {i === next && <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
            </button>
          </li>
        ))}
      </ol>
      {full && (
        <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
          প্ল্যান ছাড়াই শুরু করতে চাও?{' '}
          <button type="button" onClick={onAdd} className="font-medium text-primary underline-offset-4 hover:underline">
            আজকের খরচ লেখো
          </button>
        </p>
      )}
    </Panel>
  );
}

function MonthHero({ d }: { d: Derived }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{d.isFuture ? 'এই মাসে খরচ করা যাবে' : d.remaining < 0 ? 'মাসে বেশি গেছে' : 'মাসে বেঁচেছিল'}</div>
      <div className={cn('mt-1 font-fig text-[44px] leading-none font-semibold md:text-5xl', d.remaining < 0 && 'text-danger')}>
        {money(d.isFuture ? d.spendable : Math.abs(d.remaining))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {money(d.spendable)} খরচযোগ্য · {money(d.actual)} খরচ হয়েছে
      </p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'bad' }) {
  return (
    <div className="rounded-3xl border bg-card p-4 md:p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-fig text-2xl font-semibold', tone === 'bad' && 'text-danger')}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
