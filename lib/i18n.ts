import { defineI18n } from 'fumadocs-core/i18n';

// Spanish pilot; fr/de/it join here in phase 2 (see PRD.md).
// English URLs stay prefix-free ('default-locale'); localized files use the
// dot suffix convention (page.es.mdx, meta.es.json).
export const i18n = defineI18n({
  languages: ['en', 'es'],
  defaultLanguage: 'en',
  hideLocale: 'default-locale',
  parser: 'dot',
});

export type Locale = (typeof i18n.languages)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};
