import React from 'react';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <main className="flex-grow">{children}</main>
    </div>
  );
};
