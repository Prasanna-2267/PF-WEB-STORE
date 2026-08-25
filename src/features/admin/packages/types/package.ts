export type PackageStatus = 'draft' | 'published' | 'archived';

export interface PackageItemReference {
  contentItemId: string;
  addedAt: string;
}

export interface LearningPackage {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  status: PackageStatus;
  courseId: string | null;
  coverImageId: string | null;
  items: PackageItemReference[];
  createdAt: string;
  updatedAt: string;
}

export interface PackageInput {
  title: string;
  description?: string;
  price: number;
  status?: PackageStatus;
  courseId?: string | null;
  coverImageId?: string | null;
  contentItemIds: string[];
}
