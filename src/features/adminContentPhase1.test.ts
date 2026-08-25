import { describe, expect, it } from 'vitest';
import { mockContentRepository } from './admin/content/api/mockContentRepository';

describe('Super Admin Content Module - Phase 1 Frontend UX Rules', () => {
  it('defaults page heading to "Untitled Page" for unconfigured courses', async () => {
    const settings = await mockContentRepository.getLocationSettings('course-new-test-1', null);
    expect(settings.pageHeading).toBe('Untitled Page');
  });

  it('persists and isolates page heading edits per course', async () => {
    // Course A
    await mockContentRepository.updatePageHeading('course-alpha', null, 'CA Final Audit Notes');
    const courseA = await mockContentRepository.getLocationSettings('course-alpha', null);
    expect(courseA.pageHeading).toBe('CA Final Audit Notes');

    // Course B remains default 'Untitled Page'
    const courseB = await mockContentRepository.getLocationSettings('course-beta', null);
    expect(courseB.pageHeading).toBe('Untitled Page');
  });

  it('rejects empty, whitespace-only, and unconfigured page headings', async () => {
    await expect(mockContentRepository.updatePageHeading('course-test', null, '   ')).rejects.toThrow();
    await expect(mockContentRepository.updatePageHeading('course-test', null, 'Untitled Page')).rejects.toThrow();
    await expect(mockContentRepository.updatePageHeading('course-test', null, 'untitled_page')).rejects.toThrow();
  });

  it('correctly places published files inside the uploaded folder instead of root level', async () => {
    const courseId = 'course-nested-folder-test';
    const published = await mockContentRepository.publishContent({
      courseId,
      destinationId: null,
      entries: [
        {
          temporaryId: 'stage-folder-cert',
          parentTemporaryId: null,
          relativePath: 'Certifications and Badges',
          kind: 'folder',
          name: 'Certifications and Badges',
          size: 0,
          mimeType: null,
          accessType: 'FREE',
          price: null,
          description: '',
          sampleImages: [],
          storeSections: [],
          displayOrder: 0,
        },
        {
          temporaryId: 'stage-file-1',
          parentTemporaryId: 'stage-folder-cert',
          relativePath: 'Certifications and Badges/badge1.pdf',
          kind: 'file',
          name: 'badge1.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          accessType: 'FREE',
          price: null,
          description: '',
          sampleImages: [],
          storeSections: [],
          displayOrder: 0,
        },
      ],
    });

    const folder = published.find((item) => item.kind === 'folder');
    const file = published.find((item) => item.kind === 'file');

    expect(folder).toBeDefined();
    expect(file).toBeDefined();
    expect(file?.parentId).toBe(folder?.id);
  });

  it('resolves full breadcrumb path directions for nested folder structures and allows returning to any parent level', async () => {
    const courseId = 'course-breadcrumb-nav-test';

    const topFolder = await mockContentRepository.createFolder({
      courseId,
      parentId: null,
      name: 'Module 1',
    });

    const subFolder = await mockContentRepository.createFolder({
      courseId,
      parentId: topFolder.id,
      name: 'Chapter A',
    });

    const rootCrumbs = await mockContentRepository.getBreadcrumb(null, courseId);
    expect(rootCrumbs).toEqual([{ id: null, name: 'My Flow' }]);

    const topCrumbs = await mockContentRepository.getBreadcrumb(topFolder.id, courseId);
    expect(topCrumbs).toEqual([
      { id: null, name: 'My Flow' },
      { id: topFolder.id, name: 'Module 1' },
    ]);

    const subCrumbs = await mockContentRepository.getBreadcrumb(subFolder.id, courseId);
    expect(subCrumbs).toEqual([
      { id: null, name: 'My Flow' },
      { id: topFolder.id, name: 'Module 1' },
      { id: subFolder.id, name: 'Chapter A' },
    ]);
  });
});
