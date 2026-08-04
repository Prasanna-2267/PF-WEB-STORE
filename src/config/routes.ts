/**
 * Strictly Typed Route Registry
 */
export const ROUTES = {
  // Public Landing Page
  HOME: '/',
  HOME_ALIAS: '/home',
  ABOUT: '/about',
  CONTACT: '/contact',

  // Store
  STORE: '/store',
  STORE_CATEGORY: '/store/category/:categorySlug',
  STORE_PRODUCT: '/store/product/:productSlug',
  STORE_CART: '/store/cart',
  STORE_CHECKOUT: '/store/checkout',
  STORE_SUCCESS: '/store/checkout/success/:orderId',
  STORE_PROFILE: '/store/profile',
  STORE_PURCHASES: '/store/purchases',
  
  // Public Only Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
} as const;

const encodeStoreSlug = (slug: string): string => {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error('Store route slugs cannot be empty.');
  }

  return encodeURIComponent(normalizedSlug);
};

export type StoreCategoryPath = `/store/category/${string}`;
export type StoreProductPath = `/store/product/${string}`;

export const buildStoreCategoryPath = (categorySlug: string): StoreCategoryPath =>
  `/store/category/${encodeStoreSlug(categorySlug)}`;

export const buildStoreProductPath = (productSlug: string): StoreProductPath =>
  `/store/product/${encodeStoreSlug(productSlug)}`;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = typeof ROUTES[RouteKey];
