// Courses are database-owned. Do not constrain production records to the
// handful of legacy catalogue slugs that originally powered the UI mock-up.
export type CourseSlug = string;

export type CourseFamily = string;

export type StoreProductType =
  | 'visual-notes'
  | 'mind-maps'
  | 'revision-notes'
  | 'question-bank'
  | 'formula-sheet'
  | 'mock-test'
  | 'monthly-report'
  | 'bundle'
  | 'subscription';

export type StoreProductDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'all-levels';

export type StoreProductLanguage = 'English' | 'Hindi' | 'Hinglish';

export type StoreCollection = 'best-sellers' | 'new-releases' | 'most-popular' | 'recommended';

export type StorePreviewKind = 'cover' | 'sample-page' | 'contents';

export interface CourseCategory {
  id?: string;
  slug: CourseSlug;
  family: CourseFamily;
  name: string;
  shortName: string;
  description: string;
  subjects: readonly string[];
}

export interface StorePreviewImage {
  id: string;
  src: string;
  alt: string;
  kind: StorePreviewKind;
  role?: 'PDF_FIRST_PAGE' | 'ADMIN_PREVIEW';
}

/**
 * `price` is the current selling price in whole INR. `originalPrice` is only
 * presentation metadata; checkout must still validate the authoritative price.
 */
export interface StoreDiscount {
  originalPrice: number;
  percentage: number;
  label?: string;
}

export interface StoreProduct {
  id: string;
  title: string;
  slug: string;
  course: CourseSlug;
  courseId?: string;
  subject: string;
  faculty: string;
  coverImage?: string;
  shortDescription: string;
  description: string;
  previewImages: readonly StorePreviewImage[];
  price: number;
  currency: 'INR';
  discount: StoreDiscount | null;
  productType: StoreProductType;
  tags: readonly string[];
  difficulty: StoreProductDifficulty;
  language: StoreProductLanguage;
  releaseDate: string;
  version: string;
  isPremium: boolean;
  isActive: boolean;
  rating: number;
  ratingCount: number;
  collections: readonly StoreCollection[];
  chapters: readonly string[];
  learningOutcomes: readonly string[];
  included: readonly string[];
  audience: readonly string[];
  pageCount?: number;
  deepLink: string;
  /** Access metadata used by Question Bank cards and checkout guards. */
  accessType?: 'FREE' | 'PAID';
  includedPackages?: ReadonlyArray<{ id: string; title: string; slug: string }>;
  /** Real admin-entered store sections (heading + content). Only render when non-empty. */
  storeSections?: ReadonlyArray<{ id: string; heading: string; content: string; displayOrder: number }>;
}

export type StoreCatalogSort = 'featured' | 'newest' | 'rating' | 'price-low' | 'price-high' | 'title';

export interface StoreCatalogQuery {
  search?: string;
  course?: CourseSlug;
  subjects?: readonly string[];
  faculties?: readonly string[];
  productTypes?: readonly StoreProductType[];
  difficulties?: readonly StoreProductDifficulty[];
  languages?: readonly StoreProductLanguage[];
  tags?: readonly string[];
  chapters?: readonly string[];
  collections?: readonly StoreCollection[];
  minimumPrice?: number;
  maximumPrice?: number;
  minimumRating?: number;
  isPremium?: boolean;
  activeOnly?: boolean;
  sort?: StoreCatalogSort;
}

export interface StoreCatalogFacets {
  subjects: string[];
  faculties: string[];
  productTypes: StoreProductType[];
  difficulties: StoreProductDifficulty[];
  languages: StoreProductLanguage[];
  tags: string[];
  chapters: string[];
  minimumPrice: number;
  maximumPrice: number;
}
