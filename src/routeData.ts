import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

/**
 * SEO additions to Starlight's head tags: a preview image for shared links and
 * structured data (schema.org) for search engines.
 */

// Same picture as on bazarpro.de; 1200 × 630 as social networks expect
const PREVIEW_IMAGE = 'https://bazarpro.de/og-image.png';

const PUBLISHER = {
  '@type': 'Organization',
  name: 'BazarPro',
  url: 'https://bazarpro.de',
  logo: 'https://bazarpro.de/logo.png',
};

function jsonLd(data: Record<string, unknown>) {
  return {
    tag: 'script' as const,
    attrs: { type: 'application/ld+json' },
    content: JSON.stringify(data).replace(/</g, '\\u003c'),
  };
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { title, description, template } = route.entry.data;
  const site = context.site ?? new URL('https://docs.bazarpro.de');
  const url = new URL(context.url.pathname, site).href;
  const home = new URL(route.locale ? `/${route.locale}/` : '/', site).href;

  route.head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: PREVIEW_IMAGE } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: PREVIEW_IMAGE } }
  );

  if (route.id === '404' || route.id.endsWith('/404')) return;

  if (template === 'splash' && url === home) {
    route.head.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: route.siteTitle,
        url: home,
        inLanguage: route.lang,
        description,
        publisher: PUBLISHER,
      })
    );
    return;
  }

  route.head.push(
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url,
      mainEntityOfPage: url,
      inLanguage: route.lang,
      ...(route.lastUpdated ? { dateModified: route.lastUpdated.toISOString() } : {}),
      image: PREVIEW_IMAGE,
      author: PUBLISHER,
      publisher: PUBLISHER,
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      // Sidebar groups have no page of their own, Google wants a URL for each level
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: route.siteTitle, item: home },
        { '@type': 'ListItem', position: 2, name: title, item: url },
      ],
    })
  );
});
