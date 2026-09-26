import fs from 'node:fs';
import path from 'node:path';
import { INDEXABLE_STATIC_ROUTES, STATIC_ROUTE_METADATA, type StaticSeoMetadata } from './siteMetadata';

const escapeXml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const replaceMeta = (html: string, attribute: 'name' | 'property', key: string, value: string): string => {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/>`, 'i');
  return html.replace(pattern, `<meta ${attribute}="${key}" content="${value}" />`);
};

const renderRouteHtml = (baseHtml: string, metadata: StaticSeoMetadata, siteUrl: string): string => {
  const canonicalUrl = `${siteUrl}${metadata.canonicalPath === '/' ? '/' : metadata.canonicalPath}`;
  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${metadata.title}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonicalUrl}" />`);

  html = replaceMeta(html, 'name', 'description', metadata.description);
  html = replaceMeta(html, 'name', 'robots', metadata.robots);
  html = replaceMeta(html, 'property', 'og:title', metadata.title);
  html = replaceMeta(html, 'property', 'og:description', metadata.description);
  html = replaceMeta(html, 'property', 'og:url', canonicalUrl);
  html = replaceMeta(html, 'name', 'twitter:title', metadata.title);
  html = replaceMeta(html, 'name', 'twitter:description', metadata.description);
  html = replaceMeta(html, 'name', 'twitter:url', canonicalUrl);

  if (metadata.robots.startsWith('noindex')) {
    html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]*"\s*\/>/gi, '');
  } else {
    html = html.replace(/(<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href=")[^"]*("\s*\/>)/gi, `$1${canonicalUrl}$2`);
  }

  return html;
};

const writeRouteHtml = (distDir: string, route: string, html: string): void => {
  if (route === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
    return;
  }
  const routeDir = path.join(distDir, route.replace(/^\//, ''));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
};

export const emitProductionSeoAssets = (distDir: string, siteUrl: string): void => {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('The production index.html was not generated.');
  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  for (const [route, metadata] of STATIC_ROUTE_METADATA) {
    writeRouteHtml(distDir, route, renderRouteHtml(baseHtml, metadata, siteUrl));
  }

  const notFound = renderRouteHtml(baseHtml, {
    title: 'Page Not Found | Parallax Flow',
    description: 'The requested Parallax Flow page could not be found.',
    canonicalPath: '/',
    robots: 'noindex, nofollow, noarchive, nosnippet',
  }, siteUrl);
  fs.writeFileSync(path.join(distDir, '404.html'), notFound, 'utf8');

  const sitemapEntries = INDEXABLE_STATIC_ROUTES.map(({ canonicalPath }) => {
    const location = `${siteUrl}${canonicalPath === '/' ? '/' : canonicalPath}`;
    return `  <url><loc>${escapeXml(location)}</loc></url>`;
  }).join('\n');
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`, 'utf8');

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /academy',
    'Disallow: /student',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    'Disallow: /store/cart',
    'Disallow: /store/checkout',
    'Disallow: /store/purchases',
    'Disallow: /store/profile',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots, 'utf8');
};
