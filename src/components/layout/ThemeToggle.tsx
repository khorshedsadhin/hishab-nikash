import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setTheme, useTheme } from '@/lib/theme';

export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = theme === 'dark' ? 'লাইট মোড' : 'ডার্ক মোড';
  return (
    <Button
      variant="ghost"
      size={withLabel ? 'default' : 'icon'}
      className={withLabel ? 'w-full justify-start text-muted-foreground' : 'text-muted-foreground'}
      aria-label={label}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      {withLabel && label}
    </Button>
  );
}
