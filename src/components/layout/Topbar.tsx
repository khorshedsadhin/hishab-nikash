import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { nextMonthKey } from '@/lib/dates';
import { monthLabel } from '@/lib/format';
import { useStore } from '@/state/store';
import { AccountButton } from './AccountButton';
import { Brand } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { VIEWS, type View } from './nav';

export function Topbar({ view }: { view: View }) {
  const { state, dispatch } = useStore();
  const keys = Object.keys(state.months).sort().reverse();
  const openLabel = monthLabel(nextMonthKey(state.activeMonth)) + ' খোলো';

  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 md:px-8">
        <div className="md:hidden">
          <Brand iconOnly />
        </div>
        <h1 className="hidden text-xl font-semibold md:block">{VIEWS.find((v) => v.key === view)!.label}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Select value={state.activeMonth} onValueChange={(key) => dispatch({ type: 'selectMonth', key })}>
            <SelectTrigger aria-label="মাস" className="w-auto sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {keys.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" aria-label={openLabel} onClick={() => dispatch({ type: 'openNextMonth' })}>
                <CalendarPlus />
                <span className="hidden sm:inline">{openLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              নতুন মাসে শুধু ‘প্রতি মাসে’ লাইনগুলো যাবে, খরচের লগ যাবে না।
            </TooltipContent>
          </Tooltip>
          <div className="flex md:hidden">
            <AccountButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
