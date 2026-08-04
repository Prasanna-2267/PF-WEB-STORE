import { courseCategories, storeProducts } from './catalog';
import type {
  CourseCategory,
  CourseSlug,
  StoreCatalogFacets,
  StoreCatalogQuery,
  StoreCollection,
  StoreProduct,
} from '../types/catalog';

const textCollator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
const normaliseSearchText = (value: string) => value.trim().toLocaleLowerCase('en-IN');

const uniqueSorted = <T extends string>(values: readonly T[]): T[] =>
  Array.from(new Set(values)).sort((left, right) => textCollator.compare(left, right));

const matchesAny = <T>(value: T, choices?: readonly T[]) => !choices?.length || choices.includes(value);

const overlaps = <T>(values: readonly T[], choices?: readonly T[]) =>
  !choices?.length || choices.some((choice) => values.includes(choice));

const collectionWeight: Record<StoreCollection, number> = {
  'best-sellers': 4,
  'most-popular': 3,
  recommended: 2,
  'new-releases': 1,
};

const getFeaturedScore = (product: StoreProduct) =>
  product.collections.reduce((score, collection) => score + collectionWeight[collection], 0) * 1000 +
  product.rating * 100 +
  Math.min(product.ratingCount, 500);

const getSearchDocument = (product: StoreProduct) => {
  const course = courseCategories.find((category) => category.slug === product.course);

  return normaliseSearchText(
    [
      product.title,
      product.subject,
      product.faculty,
      product.shortDescription,
      product.description,
      product.productType,
      product.language,
      course?.name ?? '',
      ...product.tags,
      ...product.chapters,
    ].join(' '),
  );
};

/** Stable ids are used by device-local cart state. */
export const getProductById = (id: string): StoreProduct | undefined =>
  storeProducts.find((product) => product.id === id && product.isActive);

export const getCourseCategoryBySlug = (slug: CourseSlug): CourseCategory | undefined =>
  courseCategories.find((category) => category.slug === slug);

export const getProductsByCollection = (collection: StoreCollection): StoreProduct[] =>
  storeProducts.filter((product) => product.isActive && product.collections.includes(collection));

export const getProductSavings = (product: StoreProduct): number =>
  Math.max(0, (product.discount?.originalPrice ?? product.price) - product.price);

export { formatPrice, getProductBySlug, getProductsByCourse } from './catalog';

export const queryStoreProducts = (query: StoreCatalogQuery = {}): StoreProduct[] => {
  const search = query.search ? normaliseSearchText(query.search) : '';
  const activeOnly = query.activeOnly ?? true;

  const products = storeProducts.filter((product) => {
    if (activeOnly && !product.isActive) return false;
    if (query.course && product.course !== query.course) return false;
    if (!matchesAny(product.subject, query.subjects)) return false;
    if (!matchesAny(product.faculty, query.faculties)) return false;
    if (!matchesAny(product.productType, query.productTypes)) return false;
    if (!matchesAny(product.difficulty, query.difficulties)) return false;
    if (!matchesAny(product.language, query.languages)) return false;
    if (!overlaps(product.tags, query.tags)) return false;
    if (!overlaps(product.chapters, query.chapters)) return false;
    if (!overlaps(product.collections, query.collections)) return false;
    if (query.minimumPrice !== undefined && product.price < query.minimumPrice) return false;
    if (query.maximumPrice !== undefined && product.price > query.maximumPrice) return false;
    if (query.minimumRating !== undefined && product.rating < query.minimumRating) return false;
    if (query.isPremium !== undefined && product.isPremium !== query.isPremium) return false;
    if (search && !getSearchDocument(product).includes(search)) return false;
    return true;
  });

  switch (query.sort ?? 'featured') {
    case 'newest':
      return [...products].sort(
        (left, right) => Date.parse(right.releaseDate) - Date.parse(left.releaseDate),
      );
    case 'rating':
      return [...products].sort(
        (left, right) => right.rating - left.rating || right.ratingCount - left.ratingCount,
      );
    case 'price-low':
      return [...products].sort((left, right) => left.price - right.price);
    case 'price-high':
      return [...products].sort((left, right) => right.price - left.price);
    case 'title':
      return [...products].sort((left, right) => textCollator.compare(left.title, right.title));
    case 'featured':
    default:
      return [...products].sort(
        (left, right) =>
          getFeaturedScore(right) - getFeaturedScore(left) || textCollator.compare(left.title, right.title),
      );
  }
};

export const getCatalogFacets = (
  products: readonly StoreProduct[] = storeProducts.filter((product) => product.isActive),
): StoreCatalogFacets => {
  const prices = products.map((product) => product.price);

  return {
    subjects: uniqueSorted(products.map((product) => product.subject)),
    faculties: uniqueSorted(products.map((product) => product.faculty)),
    productTypes: uniqueSorted(products.map((product) => product.productType)),
    difficulties: uniqueSorted(products.map((product) => product.difficulty)),
    languages: uniqueSorted(products.map((product) => product.language)),
    tags: uniqueSorted(products.flatMap((product) => product.tags)),
    chapters: uniqueSorted(products.flatMap((product) => product.chapters)),
    minimumPrice: prices.length ? Math.min(...prices) : 0,
    maximumPrice: prices.length ? Math.max(...prices) : 0,
  };
};

export const getRelatedProducts = (product: StoreProduct, limit = 4): StoreProduct[] => {
  const productTags = new Set(product.tags);

  return storeProducts
    .filter((candidate) => candidate.isActive && candidate.id !== product.id && candidate.course === product.course)
    .map((candidate) => ({
      product: candidate,
      score:
        (candidate.subject === product.subject ? 6 : 0) +
        (candidate.productType === product.productType ? 3 : 0) +
        candidate.tags.filter((tag) => productTags.has(tag)).length +
        candidate.rating / 10,
    }))
    .sort((left, right) => right.score - left.score || textCollator.compare(left.product.title, right.product.title))
    .slice(0, Math.max(0, limit))
    .map(({ product: relatedProduct }) => relatedProduct);
};
