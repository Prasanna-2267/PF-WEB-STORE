import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  Check,
  Moon,
  Sun,
  LogOut,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useThemeStore } from '@/app/store/useThemeStore';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

export const AcademyHeader: React.FC = () => {
  const { activeAcademy } = useAcademyTenantStore();
  const { user, logout } = useAuthStore();
  const { mode, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const isSuspended = activeAcademy?.status === 'SUSPENDED';

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <header className="pf-academy-header">
      <div className="pf-academy-header__tenant">
        <div className="pf-academy-header__logo">
          <Building2 size={20} className="pf-academy-header__icon" />
        </div>
        <div className="pf-academy-header__identity">
          <div className="pf-academy-header__static-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pf-academy-header__name" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-ink)' }}>
              {activeAcademy?.name || 'Academy Admin'}
            </span>
          </div>

          <div className="pf-academy-header__badges">
            <span className="pf-academy-header__role-badge">
              <ShieldCheck size={12} style={{ marginRight: '4px' }} />
              Academy Admin Portal
            </span>
            {isSuspended && (
              <span className="pf-academy-header__suspended-badge">
                <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                Suspended
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pf-academy-header__actions">
        <button
          className="pf-academy-header__theme-btn"
          onClick={toggleTheme}
          title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="pf-academy-header__profile">
          <div className="pf-academy-header__avatar">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="pf-academy-header__user-info">
            <span className="pf-academy-header__user-name">{user?.fullName || 'Academy Admin'}</span>
            <span className="pf-academy-header__user-email">{user?.email || 'admin@academy.com'}</span>
          </div>
        </div>

        <button
          className="pf-academy-header__logout-btn"
          onClick={handleLogout}
          title="Log Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};
