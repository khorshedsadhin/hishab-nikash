import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
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
