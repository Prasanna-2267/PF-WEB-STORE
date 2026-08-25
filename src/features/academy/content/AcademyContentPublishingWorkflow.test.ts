import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyContentApi } from '@/features/academy/api/academyAcademicApi';
import { AcademyContentPublishingWorkflow, buildAcademyUploadEntries } from './AcademyContentPublishingWorkflow';

const folderFile = (name: string, relativePath: string) => {
  const file = new File(['test'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: relativePath });
  return file;
};

describe('Academy four-step content publishing hierarchy', () => {
  afterEach(() => vi.restoreAllMocks());
  it('preserves nested browser folder paths and parent relationships', () => {
    const entries = buildAcademyUploadEntries([
      folderFile('chapter-1.pdf', 'Accounting/Module A/chapter-1.pdf'),
      folderFile('chapter-2.pdf', 'Accounting/Module A/chapter-2.pdf'),
      folderFile('overview.pdf', 'Accounting/overview.pdf'),
    ]);

    expect(entries.filter((entry) => entry.kind === 'folder').map((entry) => ({ path: entry.relativePath, parent: entry.parentPath }))).toEqual([
      { path: 'Accounting', parent: '' },
      { path: 'Accounting/Module A', parent: 'Accounting' },
    ]);
    expect(entries.filter((entry) => entry.kind === 'file').map((entry) => entry.parentPath)).toEqual([
      'Accounting/Module A',
      'Accounting/Module A',
      'Accounting',
    ]);
  });

  it('keeps ordinary file selection at the current destination', () => {
    const entries = buildAcademyUploadEntries([new File(['test'], 'notes.pdf', { type: 'application/pdf' })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'file', name: 'notes.pdf', parentPath: '', relativePath: 'notes.pdf' });
  });

  it('does not write to the backend before the explicit Publish step', async () => {
    const user = userEvent.setup();
    const updateLocation = vi.spyOn(academyContentApi, 'updateLocation').mockResolvedValue({ courseId: 'course-a', folderId: null, pageHeading: 'Study Materials' });
    const upload = vi.spyOn(academyContentApi, 'upload').mockResolvedValue({} as never);
    render(React.createElement(AcademyContentPublishingWorkflow, {
      open: true,
      files: [new File(['test'], 'notes.pdf', { type: 'application/pdf' })],
      courseId: 'course-a',
      destinationId: null,
      destinationLabel: 'My Flow',
      destinationHeading: 'Study Materials',
      onClose: () => undefined,
      onPublished: () => undefined,
    }));

    expect(screen.getByText('Select')).toBeTruthy();
    expect(screen.getByText('Configure')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Publish')).toBeTruthy();
    expect(updateLocation).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continue to Configure' }));
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }));
    expect(updateLocation).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish content' }));
    expect(await screen.findByText('Publishing complete', {}, { timeout: 10000 })).toBeTruthy();
    expect(updateLocation).toHaveBeenCalledWith('course-a', null, 'Study Materials');
    expect(upload).toHaveBeenCalledTimes(1);
  }, 15000);
});
