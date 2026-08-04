const SITE_URL = 'https://parallaxflow.in';
const SCHEMA_URL = 'https://schema.org';

export type JsonLdObject = Record<string, unknown>;

export type StoreOfferAvailability =
  | 'BackOrder'
  | 'Discontinued'
  | 'InStock'
  | 'LimitedAvailability'
  | 'OnlineOnly'
  | 'OutOfStock'
  | 'PreOrder'
  | 'PreSale'
  | 'SoldOut'
  | `https://schema.org/${string}`;

export interface StoreOfferJsonLdInput {
  price: number | string;
  priceCurrency?: string;
  availability?: StoreOfferAvailability;
  url?: string;
  priceValidUntil?: string;
}

export interface StoreProductJsonLdInput {
  name: string;
  description: string;
  image: string | string[];
  url: string;
  offer: StoreOfferJsonLdInput;
  sku?: string;
  productId?: string;
  category?: string;
  brandName?: string;
}

export interface BreadcrumbJsonLdItem {
  name: string;
  url?: string;
}

export interface CategoryItemListEntry {
  name: string;
  url: string;
  image?: string;
}

export interface CategoryItemListJsonLdInput {
  name: string;
  url: string;
  items: CategoryItemListEntry[];
  description?: string;
}

const toAbsoluteUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

const toSchemaAvailabilityUrl = (availability: StoreOfferAvailability): string =>
  availability.startsWith('https://schema.org/')
    ? availability
    : `${SCHEMA_URL}/${availability}`;

export const generateOrganizationJsonLd = (): JsonLdObject[] => [
  {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Parallax Learning Hub LLP',
    alternateName: 'Parallax Flow',
    url: 'https://parallaxflow.in',
    logo: 'https://parallaxflow.in/logo.png',
    sameAs: [
      'https://www.linkedin.com/company/parallax-flow/',
      'https://www.instagram.com/parallaxflow.in',
      'https://play.google.com/store/apps/details?id=com.parallaxflow.app'
    ],
    description: 'Learning, Designed Around You.'
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Parallax Flow',
    url: 'https://parallaxflow.in',
    description: 'Intelligent Learning Platform'
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Parallax Flow Android App',
    operatingSystem: 'ANDROID',
    applicationCategory: 'EducationalApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR'
    }
  }
];

export const generateStoreOfferJsonLd = (
  offer: StoreOfferJsonLdInput,
): JsonLdObject => ({
  '@type': 'Offer',
  price: offer.price,
  priceCurrency: offer.priceCurrency ?? 'INR',
  availability: toSchemaAvailabilityUrl(offer.availability ?? 'InStock'),
  ...(offer.url ? { url: toAbsoluteUrl(offer.url) } : {}),
  ...(offer.priceValidUntil ? { priceValidUntil: offer.priceValidUntil } : {}),
});

export const generateStoreProductJsonLd = (
  product: StoreProductJsonLdInput,
): JsonLdObject => ({
  '@context': SCHEMA_URL,
  '@type': 'Product',
  name: product.name,
  description: product.description,
  image: (Array.isArray(product.image) ? product.image : [product.image]).map(toAbsoluteUrl),
  url: toAbsoluteUrl(product.url),
  brand: {
    '@type': 'Brand',
    name: product.brandName ?? 'Parallax Flow',
  },
  ...(product.sku ? { sku: product.sku } : {}),
  ...(product.productId ? { productID: product.productId } : {}),
  ...(product.category ? { category: product.category } : {}),
  offers: generateStoreOfferJsonLd({
    ...product.offer,
    url: product.offer.url ?? product.url,
  }),
});

export const generateBreadcrumbListJsonLd = (
  items: BreadcrumbJsonLdItem[],
): JsonLdObject => ({
  '@context': SCHEMA_URL,
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    ...(item.url ? { item: toAbsoluteUrl(item.url) } : {}),
  })),
});

export const generateCategoryItemListJsonLd = (
  category: CategoryItemListJsonLdInput,
): JsonLdObject => ({
  '@context': SCHEMA_URL,
  '@type': 'ItemList',
  name: category.name,
  url: toAbsoluteUrl(category.url),
  numberOfItems: category.items.length,
  itemListOrder: `${SCHEMA_URL}/ItemListOrderAscending`,
  ...(category.description ? { description: category.description } : {}),
  itemListElement: category.items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: toAbsoluteUrl(item.url),
    name: item.name,
    ...(item.image ? { image: toAbsoluteUrl(item.image) } : {}),
  })),
});
