export type PackageStatus = 'draft' | 'published' | 'archived';
export type AccessDurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

export interface PackageItemReference {
  contentItemId: string;
  addedAt: string;
  displayOrder?: number;
}

export interface PackageQuestionBankSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  accessType: 'FREE' | 'PAID';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  price: number;
  questionCount: number;
}

export interface PackageQuestionBankReference {
  questionBankId: string;
  displayOrder: number;
  addedAt: string;
  questionBank: PackageQuestionBankSummary;
}

export interface LearningPackage {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  accessDurationValue: number | null;
  accessDurationUnit: AccessDurationUnit | null;
  status: PackageStatus;
  courseId: string | null;
  coverImageId: string | null;
  items: PackageItemReference[];
  questionBanks: PackageQuestionBankReference[];
  createdAt: string;
  updatedAt: string;
}

export interface PackageInput {
  title: string;
  description?: string;
  price: number;
  accessDurationValue?: number | null;
  accessDurationUnit?: AccessDurationUnit | null;
  status?: PackageStatus;
  courseId?: string | null;
  coverImageId?: string | null;
  contentItemIds: string[];
  questionBankIds: string[];
}
