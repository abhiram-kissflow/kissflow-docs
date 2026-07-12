'use client';
import SearchDialog from '@/components/search';
import { ThemeController } from '@/components/theme-controller';
import { localeNames, type Locale } from '@/lib/i18n';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { type ReactNode } from 'react';

// Spanish strings for fumadocs' built-in UI chrome (search, TOC, theme…).
// English uses the library defaults.
const esTranslations = {
  displayName: 'Español',
  search: 'Buscar',
  searchNoResult: 'No se encontraron resultados',
  toc: 'En esta página',
  tocNoHeadings: 'Sin encabezados',
  lastUpdate: 'Última actualización',
  chooseLanguage: 'Elige un idioma',
  nextPage: 'Página siguiente',
  previousPage: 'Página anterior',
  chooseTheme: 'Tema',
  editOnGithub: 'Editar en GitHub',
  themeLight: 'Claro',
  themeDark: 'Oscuro',
  themeSystem: 'Sistema',
  codeBlockCopy: 'Copiar texto',
  codeBlockCopied: 'Texto copiado',
  bannerClose: 'Cerrar aviso',
  searchOpen: 'Abrir búsqueda',
  searchClose: 'Cerrar búsqueda',
  menuToggle: 'Abrir menú',
  themeToggle: 'Cambiar tema',
  sidebarOpen: 'Abrir barra lateral',
  sidebarCollapse: 'Contraer barra lateral',
  tocInline: 'Tabla de contenidos',
  notFoundTitle: 'Página no encontrada',
  notFoundDescription:
    'Es posible que la página que buscas haya sido eliminada, renombrada o no esté disponible temporalmente.',
  notFoundLink: 'Volver al inicio',
};

const locales = (Object.entries(localeNames) as [Locale, string][]).map(([locale, name]) => ({
  locale,
  name,
}));

export function Provider({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <RootProvider
      search={{ SearchDialog }}
      theme={{ enabled: false }}
      i18n={{
        locale,
        locales,
        translations: locale === 'es' ? esTranslations : undefined,
      }}
    >
      <ThemeController />
      {children}
    </RootProvider>
  );
}
