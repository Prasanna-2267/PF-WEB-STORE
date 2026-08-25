import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { getReadOnlyErrorCopy } from './ReadOnlyQueryState';

describe('read-only domain error handling', () => {
  it.each([
    [401, 'UNAUTHENTICATED', 'Session expired'],
    [403, 'FORBIDDEN', 'Permission denied'],
    [404, 'NOT_FOUND', 'Students not found'],
    [409, 'CONFLICT', 'Request conflict'],
    [422, 'VALIDATION_ERROR', 'Invalid request'],
    [429, 'RATE_LIMITED', 'Too many requests'],
    [503, 'SERVICE_UNAVAILABLE', 'Service unavailable'],
  ])('maps HTTP %i without converting it to data', (status, code, title) => {
    const copy = getReadOnlyErrorCopy(new ApiError('Backend message', status, code as string), 'Students');
    expect(copy.title).toBe(title);
  });

  it('maps network failure to a clear unavailable state', () => {
    expect(getReadOnlyErrorCopy(new ApiError('Offline', 0, 'NETWORK_ERROR'), 'Courses')).toEqual({
      title: 'Courses unavailable',
      description: 'Offline',
    });
  });

  it('maps an unknown transport failure without claiming success', () => {
    expect(getReadOnlyErrorCopy(new Error('socket closed'), 'Academies')).toEqual({
      title: 'Academies unavailable',
      description: 'A network error prevented this data from loading.',
    });
  });
});
