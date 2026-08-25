import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const IntegrationPendingPage: React.FC<{ module: string }> = ({ module }) => (
  <div className="pf-admin-page">
    <section className="pf-admin-card" style={{ padding: '3rem', textAlign: 'center' }}>
      <ShieldAlert size={36} aria-hidden="true" />
      <h1>{module} is not connected yet</h1>
      <p>
        This module is intentionally read-only and unavailable until its backend contract is integrated.
        No browser-only change will be presented as a successful server operation.
      </p>
    </section>
  </div>
);
