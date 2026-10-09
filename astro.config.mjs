// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.bazarpro.de',
  integrations: [
    starlight({
      title: 'BazarPro Docs',
      description:
        'Anleitungen für Veranstalter, Verkäufer und Besucher von BazarPro – und für alle, die BazarPro selbst betreiben.',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: { root: { label: 'Deutsch', lang: 'de' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/BazarPro/core' }],
      editLink: { baseUrl: 'https://github.com/BazarPro/docs/edit/main/' },
      lastUpdated: true,
      customCss: ['./src/styles/theme.css'],
      sidebar: [
        {
          label: 'Erste Schritte',
          items: [{ autogenerate: { directory: 'erste-schritte' } }],
        },
        {
          label: 'Für Veranstalter',
          items: [{ autogenerate: { directory: 'veranstalter' } }],
        },
        {
          label: 'Für Verkäufer',
          items: [{ autogenerate: { directory: 'verkaeufer' } }],
        },
      ],
    }),
  ],
});
