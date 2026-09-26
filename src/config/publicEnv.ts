const requiredUrl = (name: string, value: string | undefined): string => {
  if (!value?.trim()) throw new Error(`${name} must be configured.`);
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
};

export const publicEnv = {
  siteUrl: requiredUrl('VITE_SITE_URL', import.meta.env.VITE_SITE_URL),
  neuralWebLabsUrl: requiredUrl('VITE_NEURALWEB_LABS_URL', import.meta.env.VITE_NEURALWEB_LABS_URL),
  linkedInUrl: requiredUrl('VITE_LINKEDIN_URL', import.meta.env.VITE_LINKEDIN_URL),
  instagramUrl: requiredUrl('VITE_INSTAGRAM_URL', import.meta.env.VITE_INSTAGRAM_URL),
  playStoreUrl: requiredUrl('VITE_PLAY_STORE_URL', import.meta.env.VITE_PLAY_STORE_URL),
  whatsappUrl: requiredUrl('VITE_WHATSAPP_URL', import.meta.env.VITE_WHATSAPP_URL),
  officeMapUrl: requiredUrl('VITE_OFFICE_MAP_URL', import.meta.env.VITE_OFFICE_MAP_URL),
  postalLookupUrl: requiredUrl('VITE_POSTAL_LOOKUP_URL', import.meta.env.VITE_POSTAL_LOOKUP_URL),
  secondaryPostalLookupUrl: requiredUrl('VITE_SECONDARY_POSTAL_LOOKUP_URL', import.meta.env.VITE_SECONDARY_POSTAL_LOOKUP_URL),
} as const;
