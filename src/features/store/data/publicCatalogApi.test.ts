import { describe, expect, it } from 'vitest';

import { adaptCatalogItemToProduct } from './publicCatalogApi';

const baseItem = {
  id: 'content-1',
  courseId: 'course-1',
  price: 99,
} as const;

describe('public catalogue paid-content adapter', () => {
  it('adapts the standard catalogue name shape', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      name: 'Data_Science.pdf',
      description: 'Study notes',
      accessType: 'PAID',
    });

    expect(product.title).toBe('Data Science');
  });

  it('adapts merchandising items that expose title instead of name', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      title: 'AI_Foundation.pdf',
    });

    expect(product.title).toBe('AI Foundation');
  });

  it('uses a safe display title when a legacy record has neither field', () => {
    const product = adaptCatalogItemToProduct(baseItem);

    expect(product.title).toBe('Paid resource');
  });

  it('uses the real first-page cover endpoint for every PDF content item', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      id: 'course-agnostic-pdf',
      name: 'Organic Chemistry.pdf',
      mimeType: 'application/pdf',
      course: { id: 'any-course', name: 'Any Course', slug: 'a-dynamic-course' },
    });

    expect(product.course).toBe('a-dynamic-course');
    expect(product.coverImage).toMatch(/\/api\/catalog\/content\/course-agnostic-pdf\/cover$/);
  });

  it('serves an existing first-page cover through the validated Store endpoint', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      name: 'Tax.pdf',
      mimeType: 'application/pdf',
      sampleImages: [
        { id: 'admin', name: 'Optional preview', displayOrder: 0, role: 'ADMIN_PREVIEW', url: 'https://cdn.test/admin.png' },
        { id: 'cover', name: 'First page', displayOrder: 1, role: 'PDF_FIRST_PAGE', url: 'https://cdn.test/cover.png' },
      ],
    });

    expect(product.coverImage).toMatch(/\/api\/catalog\/content\/content-1\/cover$/);
  });

  it('keeps PDF page one first, followed by all three administrator images and text boxes', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      name: 'Complete Notes.pdf',
      mimeType: 'application/pdf',
      sampleImages: [
        { id: 'third', name: 'Third', displayOrder: 3, role: 'ADMIN_PREVIEW', url: 'https://cdn.test/3.png' },
        { id: 'first', name: 'First', displayOrder: 1, role: 'ADMIN_PREVIEW', url: 'https://cdn.test/1.png' },
        { id: 'cover', name: 'PDF page one', displayOrder: 99, role: 'PDF_FIRST_PAGE', url: 'https://cdn.test/page-1.png' },
        { id: 'second', name: 'Second', displayOrder: 2, role: 'ADMIN_PREVIEW', url: 'https://cdn.test/2.png' },
      ],
      storeSections: [
        { id: 'box-1', heading: 'Box one', content: 'First text', displayOrder: 0 },
        { id: 'box-2', heading: 'Box two', content: 'Second text', displayOrder: 1 },
        { id: 'box-3', heading: 'Box three', content: 'Third text', displayOrder: 2 },
      ],
    });

    expect(product.previewImages.map((image) => image.id)).toEqual(['cover', 'first', 'second', 'third']);
    expect(product.previewImages[0]).toMatchObject({ kind: 'cover', role: 'PDF_FIRST_PAGE' });
    expect(product.previewImages.map((image) => image.src)).toEqual([
      expect.stringMatching(/\/api\/catalog\/content\/content-1\/cover$/),
      expect.stringMatching(/\/api\/catalog\/content\/content-1\/previews\/first$/),
      expect.stringMatching(/\/api\/catalog\/content\/content-1\/previews\/second$/),
      expect.stringMatching(/\/api\/catalog\/content\/content-1\/previews\/third$/),
    ]);
    expect(product.storeSections?.map((section) => section.id)).toEqual(['box-1', 'box-2', 'box-3']);
  });

  it('uses the uploaded content preview endpoint for an image note', () => {
    const product = adaptCatalogItemToProduct({
      ...baseItem,
      id: 'image-note',
      name: 'Diagram.jpg',
      kind: 'FILE',
      mimeType: 'image/jpeg',
    });

    expect(product.coverImage).toMatch(/\/api\/catalog\/content\/image-note\/cover$/);
  });
});
