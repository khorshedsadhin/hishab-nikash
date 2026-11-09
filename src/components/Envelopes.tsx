import type { CSSProperties } from 'react';
import { money } from '@/lib/format';
import { CATEGORIES, type Derived } from '@/lib/model';
import { cn } from '@/lib/utils';
import { Meter } from './Panel';

/* Each category as an envelope: what is left of its plan. */
export function Envelopes({ d }: { d: Derived }) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {CATEGORIES.map((c) => {
        const cat = d.perCategory[c.key];
        const left = cat.planned - cat.actual;
        const over = left < 0;
        return (
          <div key={c.key} className="flex items-center gap-3 border-b py-3.5 last:border-b-0 sm:nth-last-2:border-b-0" style={{ '--tint': c.tint } as CSSProperties}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_14%,transparent)]">
              <span className="size-2.5 rounded-full bg-(--tint)" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-medium">{c.label}</span>
                {cat.planned > 0 ? (
                  <span className={cn('font-fig text-[15px] font-semibold whitespace-nowrap', over && 'text-danger')}>
                    {money(Math.abs(left))}{' '}
                    <span className="font-sans text-xs font-normal text-muted-foreground">{over ? 'বেশি' : 'বাকি'}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">প্ল্যান নেই</span>
                )}
              </div>
              <Meter
                className="mt-2"
                value={cat.planned > 0 ? (cat.actual / cat.planned) * 100 : 0}
                color={over ? 'var(--danger)' : c.tint}
              />
              <div className="mt-1.5 text-xs text-muted-foreground">
                {money(cat.actual)} / {money(cat.planned)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
