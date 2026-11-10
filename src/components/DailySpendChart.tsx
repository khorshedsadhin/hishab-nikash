import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pad, todayISO } from '@/lib/dates';
import { dayLabel, money, toBn } from '@/lib/format';
import type { Derived, Month } from '@/lib/model';

interface Day {
  day: number;
  date: string;
  amt: number;
  bill: number;
  /* Striped stub, only for past days with nothing written. */
  ghost: number;
  unlogged: boolean;
  color: string;
}

export function DailySpendChart({ m, d, monthKey }: { m: Month; d: Derived; monthKey: string }) {
  const todayStr = todayISO();
  const logged = new Set(m.loggedDays || []);
  const max = Math.max(0, ...Object.values(d.flexByDay));
  const par = d.perDay;
  const scale = Math.max(max, par * 1.5, 1);

  const data: Day[] = [];
  for (let i = 1; i <= d.dim; i++) {
    const date = monthKey + '-' + pad(i);
    /* Repeating lines are planned, so the bars show day-to-day spending only; the tooltip still names them. */
    const amt = d.flexByDay[date] || 0;
    const bill = d.fixedByDay[date] || 0;
    const unlogged = date <= todayStr && !d.byDay[date] && !logged.has(date);
    let color = 'color-mix(in srgb, var(--muted-foreground) 45%, transparent)';
    if (date > todayStr) color = 'var(--track)';
    if (amt > par) color = 'var(--warning)';
    if (date === todayStr) color = 'var(--primary)';
    data.push({ day: i, date, amt, bill, ghost: unlogged ? scale * 0.25 : 0, unlogged, color });
  }

  return (
    <div>
      {/* Shared by the chart and its legend swatch. */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="unlogged" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="5" fill="var(--muted-foreground)" opacity="0.45" />
          </pattern>
        </defs>
      </svg>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
            <XAxis
              dataKey="day"
              tickFormatter={(v: number) => toBn(v)}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis hide domain={[0, scale]} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Day;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <div className="text-muted-foreground">{dayLabel(p.date)}</div>
                    <div className="font-fig text-base">{p.unlogged ? 'লেখা হয়নি' : money(p.amt)}</div>
                    {p.bill > 0 && <div className="text-xs text-muted-foreground">বাঁধা খরচ {money(p.bill)} আলাদা</div>}
                  </div>
                );
              }}
            />
            <ReferenceLine y={par} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Bar dataKey="amt" stackId="d" radius={[4, 4, 0, 0]} minPointSize={2} isAnimationActive={false}>
              {data.map((x) => <Cell key={x.date} fill={x.color} />)}
            </Bar>
            <Bar dataKey="ghost" stackId="d" fill="url(#unlogged)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block w-5 border-t-2 border-dashed border-muted-foreground/60" />
          দিনে ধরা {money(par)}
        </span>
        <span className="flex items-center gap-2">
          <svg width="10" height="10" aria-hidden><rect width="10" height="10" fill="url(#unlogged)" /></svg>
          লেখা হয়নি
        </span>
        <span>বাঁধা খরচ বাদে</span>
      </div>
    </div>
  );
}
