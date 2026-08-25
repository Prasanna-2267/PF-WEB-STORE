import React from 'react';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { LenisProvider } from '@/providers/LenisProvider';
import { AppRouter } from '@/app/router/AppRouter';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LenisProvider>
        <div className="relative min-h-screen w-full">
          <div className="relative z-10 pointer-events-auto min-h-screen flex flex-col">
            <AuthBootstrap>
              <AppRouter />
            </AuthBootstrap>
          </div>
        </div>
      </LenisProvider>
    </ThemeProvider>
  );
};

export default App;
