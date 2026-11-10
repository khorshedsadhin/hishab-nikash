import { daysApart, todayISO, weekdayOf } from '@/lib/dates';
import { BN_WEEKDAYS, BN_WEEKDAYS_LONG, dayLabel, money, toBn } from '@/lib/format';
import type { Derived, Tone, Week } from '@/lib/model';
import { cn } from '@/lib/utils';
import { Meter } from './Panel';

function span(week: Week): string {
  const a = BN_WEEKDAYS[weekdayOf(week.start)] + ' ' + toBn(Number(week.start.slice(8, 10)));
  const b = BN_WEEKDAYS[weekdayOf(week.end)] + ' ' + dayLabel(week.end);
  return a + ' – ' + b;
}

export function WeekCard({ d }: { d: Derived & { week: Week } }) {
  const week = d.week;
  const today = todayISO();
  const over = week.left < 0;
  const daysToGo = daysApart(today, week.end) + 1;
  const amounts = week.days.map((dt) => d.flexByDay[dt] || 0);
  const scale = Math.max(...amounts, week.perDay * 1.6, 1);
  const lineAt = Math.min(100, (week.perDay / scale) * 100);

  return (
    <div>
      <div className="text-sm text-muted-foreground">এই সপ্তাহ · {span(week)}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn('font-fig text-[44px] leading-none font-semibold md:text-5xl', over && 'text-danger')}>
          {money(Math.abs(week.left))}
        </span>
        <span className="text-muted-foreground">{over ? 'বেশি গেছে' : 'বাকি'}</span>
      </div>
      <Meter
        className="mt-4"
        value={week.budget > 0 ? (week.spent / week.budget) * 100 : week.spent > 0 ? 100 : 0}
        color={over ? 'var(--danger)' : undefined}
      />
      <p className="mt-2 text-sm text-muted-foreground">
        {money(week.budget)} এর মধ্যে {money(week.spent)} খরচ
        {daysToGo > 0 && ' · ' + BN_WEEKDAYS_LONG[weekdayOf(week.end)] + ' পর্যন্ত ' + toBn(daysToGo) + ' দিন'}
      </p>

      <div
        className="relative mt-5 flex h-16 items-end gap-2"
        role="img"
        aria-label={'এই সপ্তাহের প্রতিদিনের খরচ: ' + week.days.filter((dt) => dt <= today).map((dt, i) => BN_WEEKDAYS[weekdayOf(dt)] + ' ' + money(amounts[i])).join(', ')}
      >
        <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ bottom: lineAt + '%' }} />
        <span
          className="absolute right-0 bg-card pl-1.5 text-xs text-muted-foreground"
          style={{ bottom: 'calc(' + lineAt + '% + 2px)' }}
        >
          দিনে ধরা {money(week.perDay)}
        </span>
        {week.days.map((dt, i) => {
          const amt = amounts[i];
          const future = dt > today;
          return (
            <div
              key={dt}
              title={dayLabel(dt) + ': ' + money(amt)}
              className={cn(
                'relative flex-1 rounded-t-md',
                future ? 'bg-track' : dt === today ? 'bg-primary' : amt > week.perDay ? 'bg-warning' : 'bg-muted-foreground/40'
              )}
              style={{ height: future || !amt ? '3px' : Math.max(6, (amt / scale) * 100) + '%' }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {week.days.map((dt) => (
          <span key={dt} className={cn('flex-1 text-center text-xs', dt === today ? 'font-medium text-primary' : 'text-muted-foreground')}>
            {BN_WEEKDAYS[weekdayOf(dt)]}
          </span>
        ))}
      </div>
    </div>
  );
}

const TONE_LABEL: Record<Tone, string> = { good: 'ঠিক পথে আছো', warn: 'একটু সাবধান', bad: 'বাজেট শেষ' };

/* Pace leaves repeating lines out: paying rent on the 1st is planned, not overspending. */
export function PaceBar({ d, tone }: { d: Derived; tone: Tone }) {
  const moneyPct = d.flexBudget > 0 ? Math.min(100, (d.flexSpent / d.flexBudget) * 100) : d.flexSpent > 0 ? 100 : 0;
  const dayPct = (d.elapsedDays / d.dim) * 100;
  const fill = tone === 'bad' ? 'bg-danger' : tone === 'warn' ? 'bg-warning' : 'bg-primary';
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">মাসের গতি</span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            tone === 'bad' ? 'bg-danger/12 text-danger' : tone === 'warn' ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success'
          )}
        >
          {TONE_LABEL[tone]}
        </span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-track">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', fill)} style={{ width: moneyPct + '%' }} />
        <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground" style={{ left: 'calc(' + dayPct + '% - 1px)' }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>দৈনিক খরচ {toBn(Math.round(moneyPct))}%</span>
        <span>মাস গেছে {toBn(Math.round(dayPct))}%</span>
      </div>
    </div>
  );
}
