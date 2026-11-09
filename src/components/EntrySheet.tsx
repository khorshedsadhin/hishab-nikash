import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Derived, Month } from '@/lib/model';
import { useStore } from '@/state/store';
import { EntryForm, type EntryMode } from './EntryForm';

/* A bottom sheet on phones, a centered dialog on wider screens. */
export function EntrySheet({ open, onOpenChange, mode, onMode, m, d }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EntryMode;
  onMode: (mode: EntryMode) => void;
  m: Month;
  d: Derived;
}) {
  const { state } = useStore();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92dvh] gap-4 overflow-y-auto rounded-3xl bg-card p-5 sm:max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div>
          <DialogTitle className="font-fig text-xl">লেখো</DialogTitle>
          <DialogDescription className="sr-only">খরচ বা আয় লিখে রাখো</DialogDescription>
        </div>
        <EntryForm key={state.activeMonth} m={m} d={d} mode={mode} onMode={onMode} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
