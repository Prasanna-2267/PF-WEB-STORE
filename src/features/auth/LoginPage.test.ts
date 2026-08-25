import { describe, expect, it } from 'vitest';
import { getSafeReturnDestination } from './LoginPage';

describe('Academy Admin login routing', () => {
  it('routes the canonical Academy Admin role to its tenant console', () => {
    expect(getSafeReturnDestination(undefined, 'academy_admin')).toEqual({ pathname: '/academy/overview' });
  });

  it('does not permit an Academy Admin to return into a Super Admin route', () => {
    expect(getSafeReturnDestination({ from: { pathname: '/admin/packages' } }, 'academy_admin')).toEqual({ pathname: '/academy/overview' });
  });
});
