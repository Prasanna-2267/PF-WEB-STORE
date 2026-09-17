import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { LenisProvider } from '@/providers/LenisProvider';
import { AppRouter } from '@/app/router/AppRouter';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';

export const App: React.FC = () => {
  const content = (
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
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  return googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider> : content;
};

export default App;
