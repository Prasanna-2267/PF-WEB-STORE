import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { RequireSuperAdmin } from './RequireSuperAdmin';
import { RequireAcademyAdmin } from './RequireAcademyAdmin';
import { RequireStudent } from './RequireStudent';
import { useAuthStore, type UserProfile } from '@/app/store/useAuthStore';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import * as api from '@/lib/api/client';

const user = (role: UserProfile['role'], permissions: string[] = []): UserProfile => ({ id: 'user-1', email: 'user@test.invalid', fullName: 'Test User', role, permissions });
const authenticated = (profile: UserProfile) => useAuthStore.setState({ user: profile, status: 'authenticated', initialized: true, isAuthenticated: true });

function route(element: React.ReactElement, path = '/private') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<p>login</p>} /><Route path="/" element={<p>home</p>} /><Route path="/admin/overview" element={<p>admin-home</p>} /><Route path={path} element={element} /></Routes></MemoryRouter>);
}

describe('server-derived route guards', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'anonymous', initialized: true, isAuthenticated: false });
    useAcademyTenantStore.getState().clearTenantState();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('redirects an anonymous protected request to login', () => {
    route(<RequireAuth><p>secret</p></RequireAuth>);
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('does not infer Super Admin from an email containing admin', () => {
    authenticated({ ...user('student'), email: 'admin@example.com' });
    route(<RequireSuperAdmin><p>console</p></RequireSuperAdmin>);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('requires the server permission as well as the Super Admin role', () => {
    authenticated(user('super_admin', []));
    route(<RequireSuperAdmin><p>console</p></RequireSuperAdmin>);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('blocks non-students from Student admission', () => {
    authenticated(user('admin'));
    route(<RequireStudent><p>admission</p></RequireStudent>);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('renders Academy content only after a server-resolved admin context', async () => {
    authenticated(user('admin'));
    vi.spyOn(api, 'apiRequest').mockResolvedValue({ academyId: 'academy-a', roleInAcademy: 'ACADEMY_ADMIN', membershipId: 'membership-a', permissions: ['academy:manage'] });
    route(<RequireAcademyAdmin><p>academy-console</p></RequireAcademyAdmin>);
    expect(await screen.findByText('academy-console')).toBeInTheDocument();
  });

  it('accepts the canonical Academy Admin identity only after server context resolution', async () => {
    authenticated(user('academy_admin'));
    vi.spyOn(api, 'apiRequest').mockResolvedValue({ academyId: 'academy-a', roleInAcademy: 'ACADEMY_ADMIN', membershipId: 'membership-a', permissions: ['academy:manage'] });
    route(<RequireAcademyAdmin><p>academy-console</p></RequireAcademyAdmin>);
    expect(await screen.findByText('academy-console')).toBeInTheDocument();
  });

  it('does not treat a stale local Academy object as authorization', async () => {
    authenticated(user('student'));
    useAcademyTenantStore.setState({ activeAcademyId: 'stale-academy' });
    route(<RequireAcademyAdmin><p>academy-console</p></RequireAcademyAdmin>);
    expect(await screen.findByText('Access Restricted (403)')).toBeInTheDocument();
  });
});
