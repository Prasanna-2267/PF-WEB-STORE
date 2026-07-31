export const generateOrganizationJsonLd = () => [
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
