import { toast } from 'sonner';

export function undoToast(text: string, onUndo: () => void) {
  toast(text, { duration: 5000, action: { label: 'ফেরত আনো', onClick: onUndo } });
}
