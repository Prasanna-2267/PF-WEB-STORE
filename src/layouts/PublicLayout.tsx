import React from 'react';
import { SeoHead } from '@/seo/SeoHead';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <SeoHead />
      <main className="flex-grow">{children}</main>
    </div>
  );
};
