import React from 'react';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { LenisProvider } from '@/providers/LenisProvider';
import { AppRouter } from '@/app/router/AppRouter';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LenisProvider>
        <div className="relative min-h-screen w-full">
          <div className="relative z-10 pointer-events-auto min-h-screen flex flex-col">
            <AppRouter />
          </div>
        </div>
      </LenisProvider>
    </ThemeProvider>
  );
};

export default App;
