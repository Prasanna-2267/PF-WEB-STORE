import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';
import { queryClient } from '@/lib/queryClient';
import { installNumberInputWheelGuard } from '@/lib/numberInputWheelGuard';

declare global {
  interface Window {
    __parallaxNumberInputWheelCleanup__?: () => void;
  }
}

// Reinstall safely during Vite HMR so a development refresh cannot accumulate
// duplicate document listeners.
window.__parallaxNumberInputWheelCleanup__?.();
window.__parallaxNumberInputWheelCleanup__ = installNumberInputWheelGuard();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
  </React.StrictMode>
);
