import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-danger',
  plain: 'text-foreground'
};

export function KpiCard({ label, value, sub, icon: Icon, tone = 'plain', className }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <Card className={cn('gap-1 px-5 py-4', className)}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="size-4" />}
      </div>
      <div className={cn('font-fig text-3xl leading-tight', TONE[tone])}>{value}</div>
      {sub && <div className="text-xs font-light text-muted-foreground">{sub}</div>}
    </Card>
  );
}
