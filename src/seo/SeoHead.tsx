import React, { useEffect } from 'react';
import { generateOrganizationJsonLd } from './structuredData';

interface SeoHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
}

export const SeoHead: React.FC<SeoHeadProps> = ({
  title = 'Parallax Flow',
  description = 'Learning, Designed Around You.',
  canonicalPath = '/',
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

    // 3. Canonical URL
    const canonicalUrl = `https://parallaxflow.in${canonicalPath}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 4. Open Graph Meta Tags
    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Parallax Flow' },
      { property: 'og:image', content: 'https://parallaxflow.in/logo.png' }
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

    // 5. Twitter Card Meta Tags
    const twitterTags = [
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:url', content: canonicalUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: 'https://parallaxflow.in/logo.png' }
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

    // 6. JSON-LD Structured Data
    const jsonLdScriptId = 'parallax-flow-jsonld';
    let script = document.getElementById(jsonLdScriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = jsonLdScriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(generateOrganizationJsonLd());
  }, [title, description, canonicalPath]);

  return null;
};
