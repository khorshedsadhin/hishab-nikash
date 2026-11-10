import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { syncThemeColor } from '@/lib/theme';
import { StoreProvider } from '@/state/store';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <TooltipProvider>
        <App />
        <Toaster position="top-center" />
      </TooltipProvider>
    </StoreProvider>
  </StrictMode>
);

syncThemeColor();

/* Offline support for the installed app; dev keeps the network path plain. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
