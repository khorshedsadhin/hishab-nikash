import { CalendarCheck, CalendarDays, CalendarX, Info, Lock, TriangleAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DailySpendChart } from '@/components/DailySpendChart';
import { KpiCard } from '@/components/KpiCard';
import { Ledger } from '@/components/Ledger';
import { QuickAdd } from '@/components/QuickAdd';
import { todayISO } from '@/lib/dates';
import { money, toBn } from '@/lib/format';
import { headline, streak, tone, type Derived, type Month } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

const BANNER = {
  good: 'border-success/40 bg-success/10 [&>svg]:text-success',
  warn: 'border-warning/40 bg-warning/10 [&>svg]:text-warning',
  bad: 'border-danger/40 bg-danger/10 [&>svg]:text-danger'
};

export function TodayView({ m, d }: { m: Month; d: Derived }) {
  const { state, dispatch } = useStore();
  const t = tone(d);
  const s = streak(state);
  const todayStr = todayISO();
  const showZeroDay = d.isCurrent && !(m.loggedDays || []).includes(todayStr);

  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard
          label="হাতে আছে"
          icon={Wallet}
          tone={t}
          value={money(d.remaining)}
          sub={money(d.spendable) + ' এর মধ্যে ' + money(d.actual) + ' খরচ হয়েছে · ' + toBn(d.daysLeft) + ' দিন বাকি'}
          className="col-span-2 xl:col-span-1"
        />
        <KpiCard
          label="আজ খরচ"
          icon={CalendarDays}
          tone={d.todaySpent > d.dailyAllowance ? 'bad' : 'plain'}
          value={money(d.todaySpent)}
          sub={'ভাগে ছিল ' + money(d.dailyAllowance)}
        />
        <KpiCard
          label="এই সপ্তাহে"
          icon={CalendarCheck}
          tone={d.thisWeekSpent > d.weeklyAllowance ? 'bad' : 'plain'}
          value={money(d.thisWeekSpent)}
          sub={'ভাগে ছিল ' + money(d.weeklyAllowance)}
        />
        <KpiCard
          label="খোলা আছে"
          className="col-span-2 xl:col-span-1"
          icon={Lock}
          value={money(Math.max(0, d.safeRemaining))}
          sub={d.committedLeft > 0 ? 'এর মধ্যে ' + money(d.committedLeft) + ' বাঁধা খরচে আটকে আছে' : undefined}
        />
      </div>

      <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', BANNER[t])}>
        {t === 'good' ? <Info className="mt-0.5 size-5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-5 shrink-0" />}
        <div className="min-w-0">
          <p className="text-[17px] font-medium">{headline(d)}</p>
          <p className={cn('text-sm font-light', s.warn ? 'text-warning' : 'text-muted-foreground')}>{s.text}</p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>দিনের খরচ</CardTitle>
          </CardHeader>
          <CardContent>
            <DailySpendChart m={m} d={d} monthKey={state.activeMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>খরচ লেখো</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <QuickAdd key={state.activeMonth} m={m} d={d} />
            {showZeroDay && (
              <Button
                variant="outline"
                className="border-dashed text-muted-foreground hover:border-success hover:text-success"
                onClick={() => dispatch({ type: 'markZeroDay' })}
              >
                <CalendarX />
                আজ কিছু খরচ হয়নি
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>সাম্প্রতিক খরচ</CardTitle>
        </CardHeader>
        <CardContent>
          <Ledger log={m.log} limit={12} />
        </CardContent>
      </Card>
    </div>
  );
}
