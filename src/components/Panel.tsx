import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-3xl border bg-card p-5 md:p-6', className)} {...props} />;
}

export function PanelTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-fig text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/* A thin progress track; `value` is a 0-100 share. */
export function Meter({ value, color, className }: { value: number; color?: string; className?: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-track', className)}>
      <div className="h-full rounded-full" style={{ width: width + '%', background: color || 'var(--primary)' }} />
    </div>
  );
}
