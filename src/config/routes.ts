/**
 * Strictly Typed Route Registry
 */
export const ROUTES = {
  // Public Landing Page
  HOME: '/',
  HOME_ALIAS: '/home',
  ABOUT: '/about',
  CONTACT: '/contact',
  
  // Public Only Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = typeof ROUTES[RouteKey];
