import { Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SyncBadge } from './SyncBadge';
import { VIEWS, type View } from './nav';

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wallet className="size-4.5" />
      </span>
      <span className="font-fig text-[22px] font-semibold">হিসাব</span>
    </div>
  );
}

export function Sidebar({ view, onView, onAdd }: { view: View; onView: (v: View) => void; onAdd: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-sidebar px-4 py-6 md:flex">
      <div className="px-2">
        <Brand />
      </div>
      <Button size="lg" className="h-11 rounded-xl font-fig text-base font-semibold" onClick={onAdd}>
        <Plus className="size-5" />
        লেখো
      </Button>
      <nav aria-label="প্রধান" className="flex flex-col gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-current={v.key === view ? 'page' : undefined}
            onClick={() => onView(v.key)}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors',
              v.key === view
                ? 'bg-muted font-medium text-foreground [&_svg]:text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <v.icon className="size-5" />
            {v.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto px-1">
        <SyncBadge />
      </div>
    </aside>
  );
}

export function MobileNav({ view, onView, onAdd }: { view: View; onView: (v: View) => void; onAdd: () => void }) {
  const left = VIEWS.slice(0, 2);
  const right = VIEWS.slice(2);
  const item = (v: (typeof VIEWS)[number]) => (
    <button
      key={v.key}
      type="button"
      aria-current={v.key === view ? 'page' : undefined}
      onClick={() => onView(v.key)}
      className={cn(
        'flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs',
        v.key === view ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <v.icon className="size-5.5" />
      {v.label}
    </button>
  );
  return (
    <nav
      aria-label="প্রধান"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 py-1.5">
        {left.map(item)}
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="লেখো"
            onClick={onAdd}
            className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Plus className="size-7" />
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
