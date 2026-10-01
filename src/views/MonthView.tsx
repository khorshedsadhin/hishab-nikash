import { useRef, useState, type FormEvent } from 'react';
import { Download, PiggyBank, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { KpiCard } from '@/components/KpiCard';
import { Ledger } from '@/components/Ledger';
import { NumberInput } from '@/components/NumberInput';
import { todayISO } from '@/lib/dates';
import { dayLabel, money, monthLabel } from '@/lib/format';
import { reconRows, savedTotal, suggestedCashStart, type Derived, type Month, type State } from '@/lib/model';
import { exportData, parseImport } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useStore } from '@/state/store';

export function MonthView({ m, d }: { m: Month; d: Derived }) {
  const { state } = useStore();

  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <KpiCard label="জমেছে মোট" icon={PiggyBank} tone="good" value={money(savedTotal(state))} className="col-span-2 lg:col-span-1" />
        <KpiCard label="আয়" value={money(m.income)} />
        <KpiCard
          label="আসলে সরানো হয়েছে"
          tone={m.saved == null ? 'plain' : m.saved >= m.savingsTarget ? 'good' : 'bad'}
          value={m.saved == null ? <span className="text-xl text-muted-foreground">লেখা হয়নি</span> : money(m.saved)}
          sub={'সরিয়ে রাখার কথা ছিল ' + money(m.savingsTarget)}
        />
        <KpiCard label="খরচ হয়েছে" value={money(d.actual)} />
        <KpiCard label="আসলে থাকল" tone={d.remaining < 0 ? 'bad' : 'good'} value={money(m.income - d.actual)} />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Reconcile m={m} />
        <div className="grid content-start gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle><label htmlFor="reflection">পরের মাসে কী বদলাবে?</label></CardTitle>
            </CardHeader>
            <CardContent>
              <Reflection m={m} />
            </CardContent>
          </Card>
          <Backup />
          <DeleteMonth />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{monthLabel(state.activeMonth)}র পুরো খরচ</CardTitle>
        </CardHeader>
        <CardContent>
          <Ledger log={m.log} />
        </CardContent>
      </Card>
    </div>
  );
}

function Reflection({ m }: { m: Month }) {
  const { dispatch } = useStore();
  return (
    <Textarea
      id="reflection"
      placeholder="এক লাইনই যথেষ্ট"
      value={m.reflection}
      onChange={(e) => dispatch({ type: 'setReflection', value: e.target.value })}
      className="min-h-20"
    />
  );
}

function Reconcile({ m }: { m: Month }) {
  const { state, dispatch } = useStore();
  const [checkAmount, setCheckAmount] = useState('');
  const [checkDate, setCheckDate] = useState(todayISO());
  const amountRef = useRef<HTMLInputElement>(null);
  const suggest = suggestedCashStart(state, state.activeMonth);
  const rows = reconRows(m);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (checkAmount === '') {
      amountRef.current?.focus();
      return;
    }
    dispatch({ type: 'addCheck', date: checkDate || todayISO(), amount: Number(checkAmount) || 0 });
    setCheckAmount('');
    setCheckDate(todayISO());
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>সত্যি মিলিয়ে দেখো</CardTitle>
        <CardDescription>খাতার হিসাব আর পকেটের টাকা মিলছে কি না — না মিললে যেটুকু ফাঁক, সেটুকু খরচ লেখা হয়নি।</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            মাসের শুরুতে হাতে ছিল
            <NumberInput
              nullable
              value={m.cashStart}
              disabled={m.locked}
              placeholder={suggest == null ? undefined : String(suggest)}
              onValue={(v) => dispatch({ type: 'setCashStart', value: v })}
              className="font-fig text-foreground"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            সরিয়ে রাখা হয়েছে
            <NumberInput
              nullable
              value={m.saved}
              placeholder={String(m.savingsTarget)}
              onValue={(v) => dispatch({ type: 'setSaved', value: v })}
              className="font-fig text-foreground"
            />
          </label>
        </div>

        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input
            ref={amountRef}
            type="number"
            inputMode="numeric"
            placeholder="এখন হাতে কত"
            aria-label="এখন হাতে কত"
            value={checkAmount}
            onChange={(e) => setCheckAmount(e.target.value)}
            className="min-w-32 flex-1 font-fig"
          />
          <Input
            type="date"
            aria-label="তারিখ"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
            className="w-auto min-w-36 flex-1"
          />
          <Button type="submit">মিলাও</Button>
        </form>

        {m.cashStart == null && (
          <p className="text-sm font-light text-muted-foreground">শুরুতে হাতে কত ছিল সেটা বসালেই মেলানো শুরু হবে।</p>
        )}

        {rows.length > 0 && (
          <div className="divide-y rounded-lg border">
            {rows.map(({ check, expected, gap }) => (
              <div key={check.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <span className="text-sm font-medium">{dayLabel(check.date)}</span>
                <span className="flex-1 text-xs font-light text-muted-foreground">
                  হাতে {money(check.amount)}{expected == null ? '' : ' · খাতায় ' + money(expected)}
                </span>
                <span className={cn(
                  'text-sm',
                  gap == null || gap < 0 ? 'text-muted-foreground' : gap > 0 ? 'text-danger' : 'text-success'
                )}>
                  {gap == null
                    ? 'শুরুর টাকা বসাও'
                    : gap > 0
                      ? money(gap) + ' খরচ লেখা হয়নি'
                      : gap < 0
                        ? money(Math.abs(gap)) + ' বেশি আছে — কোনো আয় লেখা হয়নি'
                        : 'মিলে গেছে'}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-danger"
                  aria-label="মুছে ফেলো"
                  onClick={() => dispatch({ type: 'deleteCheck', id: check.id })}
                >
                  <X />
                </Button>
                {gap != null && gap > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="basis-full text-primary"
                    onClick={() => dispatch({ type: 'fillGap', checkId: check.id })}
                  >
                    অজানা খরচ হিসেবে লিখে দাও
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Backup() {
  const { state, dispatch } = useStore();
  const [pending, setPending] = useState<State | null>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImport(String(reader.result));
      if ('error' in result) toast.error(result.error);
      else setPending(result.state);
    };
    reader.readAsText(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ব্যাকআপ</CardTitle>
        <CardDescription>ব্রাউজারের ডেটা মুছলে হিসাবও মুছে যায়। মাসে একবার নামিয়ে রাখো।</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => exportData(state)}>
          <Download />
          ব্যাকআপ নামাও
        </Button>
        <Button variant="outline" asChild>
          <label>
            <Upload />
            ব্যাকআপ ফেরত আনো
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </Button>
      </CardContent>

      <AlertDialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যাকআপ ফেরত আনবে?</AlertDialogTitle>
            <AlertDialogDescription>এখনকার সব ডেটা মুছে ফাইলেরটা বসবে। ঠিক আছে?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) dispatch({ type: 'importState', state: pending });
                setPending(null);
              }}
            >
              হ্যাঁ, বসাও
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DeleteMonth() {
  const { state, dispatch } = useStore();
  const label = monthLabel(state.activeMonth);

  return (
    <Card>
      <CardHeader>
        <CardTitle>মাস মুছে ফেলো</CardTitle>
        <CardDescription>{label}র পরিকল্পনা, খরচ, মিলানো সব মুছে যাবে।</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 />
              এই মাস মুছে ফেলো
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{label} মুছে ফেলবে?</AlertDialogTitle>
              <AlertDialogDescription>
                এই মাসের সব হিসাব মুছে যাবে, ফেরত আনা যাবে না। পরের মাসে ‘আগের মাস থেকে’ আসা টাকাও আর আসবে না।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>না</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  dispatch({ type: 'deleteMonth' });
                  toast.success(label + ' মুছে ফেলা হয়েছে।');
                }}
              >
                হ্যাঁ, মুছে ফেলো
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
