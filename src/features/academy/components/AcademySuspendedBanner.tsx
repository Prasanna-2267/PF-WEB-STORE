import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

interface AcademySuspendedBannerProps {
  academyName?: string;
}

export const AcademySuspendedBanner: React.FC<AcademySuspendedBannerProps> = ({ academyName }) => {
  return (
    <div className="pf-academy-suspended-banner">
      <div className="pf-academy-suspended-banner__content">
        <AlertTriangle size={24} className="pf-academy-suspended-banner__icon" />
        <div>
          <h4 className="pf-academy-suspended-banner__title">
            {academyName || 'This Academy'} is Currently Suspended
          </h4>
          <p className="pf-academy-suspended-banner__desc">
            Operational modifications are disabled in read-only mode. Please contact Parallax Flow platform administration to restore full Academy privileges.
          </p>
        </div>
      </div>
      <div className="pf-academy-suspended-banner__lock">
        <Lock size={16} />
        <span>Read-Only Mode Active</span>
      </div>
    </div>
  );
};
