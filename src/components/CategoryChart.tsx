import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '@/lib/format';
import { CATEGORIES, type Derived } from '@/lib/model';

export function CategoryChart({ d }: { d: Derived }) {
  const data = CATEGORIES.map((c) => ({
    label: c.label,
    tint: c.tint,
    planned: d.perCategory[c.key].planned,
    actual: d.perCategory[c.key].actual
  }));

  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap="24%">
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              interval={0}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-muted-foreground">খরচ <span className="font-fig text-foreground">{money(p.actual)}</span></div>
                    <div className="text-muted-foreground">প্ল্যান <span className="font-fig text-foreground">{money(p.planned)}</span></div>
                  </div>
                );
              }}
            />
            <Bar dataKey="planned" fill="var(--border)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="actual" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((x) => <Cell key={x.label} fill={x.tint} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-border" />প্ল্যান</span>
        <span className="flex items-center gap-1.5">
          <span className="flex">
            {CATEGORIES.map((c) => <span key={c.key} className="size-2.5 first:rounded-l-sm last:rounded-r-sm" style={{ background: c.tint }} />)}
          </span>
          খরচ
        </span>
      </div>
    </div>
  );
}
