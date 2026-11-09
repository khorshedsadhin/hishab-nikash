import { useSyncExternalStore } from 'react';
import { CloudAlert, CloudCheck, CloudOff } from 'lucide-react';
import { getStatus, subscribe } from '@/lib/sync';
import { cn } from '@/lib/utils';

export function SyncBadge({ className }: { className?: string }) {
  const s = useSyncExternalStore(subscribe, getStatus);
  const Icon = !s.username ? CloudOff : s.error ? CloudAlert : CloudCheck;
  const text = !s.username ? 'শুধু এই ডিভাইসে' : s.error ? 'সিঙ্ক হয়নি' : s.pending ? 'সিঙ্ক হচ্ছে…' : 'সিঙ্ক হয়েছে';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground',
        className
      )}
    >
      <Icon className={cn('size-3.5', s.username && !s.error ? 'text-success' : s.error ? 'text-warning' : '')} />
      {text}
    </span>
  );
}
