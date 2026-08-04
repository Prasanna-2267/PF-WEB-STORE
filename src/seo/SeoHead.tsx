import React, { useEffect } from 'react';
import { generateOrganizationJsonLd, JsonLdObject } from './structuredData';

interface SeoHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  robots?: string;
  ogType?: string;
  image?: string;
  jsonLd?: JsonLdObject | JsonLdObject[];
}

const SITE_URL = 'https://parallaxflow.in';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const toAbsoluteUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

export const SeoHead: React.FC<SeoHeadProps> = ({
  title = 'Parallax Flow',
  description = 'Learning, Designed Around You.',
  canonicalPath = '/',
  robots = 'index, follow',
  ogType = 'website',
  image = DEFAULT_IMAGE,
  jsonLd,
}) => {
  useEffect(() => {
    // 1. Document Title
    document.title = title;

    // 2. Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Robots
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', robots);

    // 4. Canonical URL
    const canonicalUrl = toAbsoluteUrl(canonicalPath);
    const socialImageUrl = toAbsoluteUrl(image);
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 5. Open Graph Meta Tags
    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: ogType },
      { property: 'og:site_name', content: 'Parallax Flow' },
      { property: 'og:image', content: socialImageUrl }
    ];

    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // 6. Twitter Card Meta Tags
    const twitterTags = [
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:url', content: canonicalUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: socialImageUrl }
    ];

    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // 7. JSON-LD Structured Data
    const jsonLdScriptId = 'parallax-flow-jsonld';
    let script = document.getElementById(jsonLdScriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = jsonLdScriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const routeJsonLd = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    script.text = JSON.stringify([...generateOrganizationJsonLd(), ...routeJsonLd]);
  }, [title, description, canonicalPath, robots, ogType, image, jsonLd]);

  return null;
};
