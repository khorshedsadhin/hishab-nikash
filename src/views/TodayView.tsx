import { CalendarCheck2, CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailySpendChart } from '@/components/DailySpendChart';
import { EntryForm, type EntryMode } from '@/components/EntryForm';
import { Envelopes } from '@/components/Envelopes';
import { Ledger } from '@/components/Ledger';
import { Panel, PanelTitle } from '@/components/Panel';
import { PaceBar, WeekCard } from '@/components/WeekCard';
import { MonthPicker, PageHeader } from '@/components/layout/PageHeader';
import { prevMonthKey, todayISO, weekdayOf } from '@/lib/dates';
import { BN_WEEKDAYS_LONG, dayLabel, money, monthLabel, toBn } from '@/lib/format';
import { canClose, headline, streak, tone, type Derived, type Month, type Week } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

const PACE_LABEL = { good: 'ঠিক পথে আছো', warn: 'একটু সাবধান', bad: 'বাজেট শেষ' };

export function TodayView({ m, d, mode, onMode, onCloseMonth }: {
  m: Month;
  d: Derived;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  onCloseMonth: (key: string) => void;
}) {
  const { state, dispatch } = useStore();
  const today = todayISO();
  const s = streak(state);
  const t = tone(d);
  const showZeroDay = d.isCurrent && !(m.loggedDays || []).includes(today);
  const closeKey = canClose(state, state.activeMonth)
    ? state.activeMonth
    : d.isCurrent && canClose(state, prevMonthKey(state.activeMonth)) ? prevMonthKey(state.activeMonth) : null;

  return (
    <>
      <PageHeader title="আজ" sub={BN_WEEKDAYS_LONG[weekdayOf(today)] + ', ' + dayLabel(today)}>
        <MonthPicker />
      </PageHeader>

      {closeKey && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/8 px-4 py-3">
          <CalendarCheck2 className="size-5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm">
            <b className="font-medium">{monthLabel(closeKey)}</b> বন্ধ করা বাকি। হাতের টাকা মিলিয়ে পরের মাস শুরু করো।
          </p>
          <Button size="sm" className="rounded-lg" onClick={() => onCloseMonth(closeKey)}>বন্ধ করো</Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel>
            <div className="grid gap-6 xl:grid-cols-2 xl:gap-8">
              {d.week ? <WeekCard d={d as Derived & { week: Week }} /> : <MonthHero d={d} />}
              <div className="grid content-center gap-5 border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8">
                <PaceBar d={d} label={PACE_LABEL[t]} />
                {t !== 'good' && <p className="text-sm text-warning">{headline(d)}</p>}
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3 md:gap-5">
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
          </div>

          <Panel>
            <PanelTitle>খাত</PanelTitle>
            <Envelopes d={d} />
          </Panel>

          <Panel>
            <PanelTitle>দিনের খরচ</PanelTitle>
            <DailySpendChart m={m} d={d} monthKey={state.activeMonth} />
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel className="hidden lg:block">
            <PanelTitle>লেখো</PanelTitle>
            <EntryForm key={state.activeMonth} m={m} d={d} mode={mode} onMode={onMode} />
          </Panel>

          <Panel>
            <PanelTitle>সাম্প্রতিক</PanelTitle>
            <p className={cn('-mt-1 mb-3 text-xs', s.warn ? 'text-warning' : 'text-muted-foreground')}>{s.text}</p>
            {showZeroDay && (
              <Button
                variant="outline"
                className="mb-3 h-10 w-full rounded-xl border-dashed text-muted-foreground hover:border-success hover:text-success"
                onClick={() => dispatch({ type: 'markZeroDay' })}
              >
                <CalendarX />
                আজ কিছু খরচ হয়নি
              </Button>
            )}
            <Ledger log={m.log} days={5} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function MonthHero({ d }: { d: Derived }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{d.isFuture ? 'এই মাসে খরচ করা যাবে' : 'মাসে বাকি ছিল'}</div>
      <div className={cn('mt-1 font-fig text-[44px] leading-none font-semibold md:text-5xl', d.remaining < 0 && 'text-danger')}>
        {money(d.isFuture ? d.spendable : d.remaining)}
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
