import React, { useEffect } from 'react';
import { useAuthStore } from '@/app/store/useAuthStore';

export const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialized = useAuthStore((state) => state.initialized);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  if (!initialized) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Restoring your secure session&hellip;
      </div>
    );
  }
  return <>{children}</>;
};
