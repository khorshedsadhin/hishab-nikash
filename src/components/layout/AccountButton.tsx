import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { CircleUser, LogIn, LogOut, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getStatus, signIn, signOut, subscribe } from '@/lib/sync';

const ERRORS: Record<string, string> = {
  username: 'নাম ৩ থেকে ৩২ অক্ষরের, শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, _ আর .',
  password: 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।',
  taken: 'এই নামটা আগেই নেওয়া হয়েছে।',
  invalid: 'নাম বা পাসওয়ার্ড মিলছে না।',
  locked: 'অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করো।',
  network: 'সার্ভারে পৌঁছানো গেল না।'
};

export function AccountButton({ withLabel }: { withLabel?: boolean }) {
  const status = useSyncExternalStore(subscribe, getStatus);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const label = status.username || 'লগ ইন';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signIn(mode, username, password);
    setBusy(false);
    if (err) {
      toast.error(ERRORS[err] || ERRORS.network);
      return;
    }
    setPassword('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={withLabel ? 'default' : 'icon'}
          className={withLabel ? 'w-full justify-start text-muted-foreground' : 'text-muted-foreground'}
          aria-label={withLabel ? undefined : label}
        >
          <CircleUser />
          {withLabel && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {status.username ? (
          <>
            <DialogHeader>
              <DialogTitle>অ্যাকাউন্ট: {status.username}</DialogTitle>
              <DialogDescription>
                {status.error ? 'সিঙ্ক করা গেল না, পরে আবার চেষ্টা হবে।' : status.pending ? 'সিঙ্ক হচ্ছে…' : 'সব হিসাব সার্ভারে রাখা আছে।'}
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" className="justify-self-start" onClick={() => void signOut()}>
              <LogOut />
              লগ আউট
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{mode === 'login' ? 'লগ ইন' : 'অ্যাকাউন্ট খোলো'}</DialogTitle>
              <DialogDescription>
                {mode === 'login'
                  ? 'লগ ইন করলে হিসাব সার্ভারে থাকে, অন্য ফোনেও পাবে।'
                  : 'পাসওয়ার্ড ভুলে গেলে ফেরত পাওয়ার কোনো উপায় নেই। পাসওয়ার্ড মনে রাখো, ব্যাকআপও রাখো।'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-2">
              <Input
                placeholder="নাম (username)"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="পাসওয়ার্ড"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={busy}>
                  {mode === 'login' ? <LogIn /> : <UserPlus />}
                  {mode === 'login' ? 'লগ ইন' : 'অ্যাকাউন্ট খোলো'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                  {mode === 'login' ? 'নতুন অ্যাকাউন্ট' : 'আগে থেকে আছে? লগ ইন'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
