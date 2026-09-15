import { describe, expect, it } from 'vitest';

import { resolveStoreCourseSelection } from './useStoreContext';

describe('Store course selection', () => {
  it('selects the first enrolled course when a signed-in student still has the anonymous all value', () => {
    expect(resolveStoreCourseSelection('all', ['foundation', 'advanced'])).toBe('foundation');
  });

  it('preserves any valid dynamic course selection', () => {
    expect(resolveStoreCourseSelection('advanced', ['foundation', 'advanced'])).toBe('advanced');
  });

  it('returns to all courses when no enrolled course applies', () => {
    expect(resolveStoreCourseSelection('legacy-course', [])).toBe('all');
  });
});
