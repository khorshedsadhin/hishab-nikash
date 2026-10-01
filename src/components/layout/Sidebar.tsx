import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountButton } from './AccountButton';
import { ThemeToggle } from './ThemeToggle';
import { VIEWS, type View } from './nav';

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      <span className="font-fig text-xl tracking-wide">হিসাব</span>
    </div>
  );
}

export function Sidebar({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
      <div className="px-3 pb-6">
        <Brand />
      </div>
      <nav className="flex flex-col gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-current={v.key === view ? 'page' : undefined}
            onClick={() => onView(v.key)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors',
              v.key === view
                ? 'bg-primary/12 font-medium text-foreground [&_svg]:text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <v.icon className="size-4" />
            {v.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto grid gap-1">
        <AccountButton withLabel />
        <ThemeToggle withLabel />
      </div>
    </aside>
  );
}

export function MobileNav({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-sidebar/95 backdrop-blur md:hidden">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-current={v.key === view ? 'page' : undefined}
          onClick={() => onView(v.key)}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
            v.key === view ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <v.icon className="size-5" />
          {v.label}
        </button>
      ))}
    </nav>
  );
}
