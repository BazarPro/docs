// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.bazarpro.de',
  integrations: [
    starlight({
      title: { de: 'BazarPro Docs', en: 'BazarPro Docs' },
      description:
        'Anleitungen für Kinderkleiderbasar, Fahrradbörse und Flohmarkt mit BazarPro – für Veranstalter, Verkäufer und alle, die BazarPro selbst betreiben.',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      // German pages live in the root, English translations under /en/ with the same file names
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
        en: { label: 'English', lang: 'en' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/BazarPro/core' }],
      editLink: { baseUrl: 'https://github.com/BazarPro/docs/edit/main/' },
      lastUpdated: true,
      customCss: ['./src/styles/theme.css'],
      sidebar: [
        {
          label: 'Erste Schritte',
          translations: { en: 'Getting started' },
          items: [{ autogenerate: { directory: 'erste-schritte' } }],
        },
        {
          label: 'Für Veranstalter',
          translations: { en: 'For organizers' },
          items: [{ autogenerate: { directory: 'veranstalter' } }],
        },
        {
          label: 'Für Verkäufer',
          translations: { en: 'For sellers' },
          items: [{ autogenerate: { directory: 'verkaeufer' } }],
        },
        {
          label: 'Ratgeber',
          translations: { en: 'Guides' },
          items: [{ autogenerate: { directory: 'ratgeber' } }],
        },
        {
          label: 'Selbst hosten',
          translations: { en: 'Self-hosting' },
          items: [{ autogenerate: { directory: 'selbst-hosten' } }],
        },
      ],
    }),
  ],
});
