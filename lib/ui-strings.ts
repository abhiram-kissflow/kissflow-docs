'use client';

import { useI18n } from 'fumadocs-ui/contexts/i18n';

// UI chrome strings for our custom components. English values must match the
// previous hardcoded strings exactly; card DATA (roadmap items, pre-release
// notes) intentionally stays English — see PRD.md non-goals.
const en = {
  hero: {
    title: 'Everything Kissflow, answered',
    subtitle:
      'Ask across every guide, API, and SDK — grounded, with sources. Or browse articles in the folders below.',
    placeholder: 'Ask anything about Kissflow…',
    followUpPlaceholder: 'Ask a follow-up…',
    askAria: 'Ask',
    browseFolders: 'Browse folders',
    searching: 'Searching the docs…',
    unavailable: 'The assistant is unavailable right now. Please try again.',
    notFound: "I couldn't find that in the Kissflow docs. Try rephrasing, or browse by role.",
    relevantArticles: 'Relevant articles',
    noRelated: 'No related articles.',
    readMore: 'Read more',
  },
  persona: {
    'end-users': { title: 'End Users', description: 'Submit forms, track items, approve tasks, use boards.' },
    builders: { title: 'Workflow & App Builders', description: 'Design pages, build workflows, create apps with no-code and AI.' },
    admins: { title: 'Admins', description: 'Manage users, security, SSO, governance, and environments.' },
    'api-docs': { title: 'API Docs', description: 'REST API reference — endpoints, requests, and responses.' },
    'sdk-docs': { title: 'SDK Docs', description: 'Build custom components with the Kissflow JavaScript SDK.' },
    roadmap: { title: 'Roadmap', description: 'What we are building next across Kissflow.' },
    prerelease: { title: 'Pre-release Notes', description: 'Upcoming features and changes before they ship.' },
    announcements: { title: 'Announcements', description: 'Every new feature and improvement as it ships, newest first.' },
  },
  roadmap: {
    intro:
      'This roadmap offers a look at the future of Kissflow. Our goal is to keep you informed so you can plan effectively and provide the feedback that shapes our product.',
    disclaimer:
      'These plans are subject to change and do not represent a commitment to specific features or timelines.',
    yearAria: 'Roadmap year',
    statuses: {
      shipped: 'Shipped',
      'in-progress': 'In progress',
      planned: 'Planned',
      deferred: 'Deferred',
    },
  },
  prerelease: {
    intro:
      'Details of features and changes scheduled for upcoming Kissflow releases, published ahead of rollout so you can prepare your account, users, and integrations.',
    disclaimer:
      "Timelines and scope can shift before release. For updates that are already live, see the What's New section.",
    yearAria: 'Pre-release notes year',
    loading: (year: string) => `Loading ${year} notes…`,
    loadError: (year: string) => `Couldn't load the notes for ${year}. Please refresh and try again.`,
    note: 'note',
    notes: 'notes',
  },
  launcher: {
    assistantTitle: 'Kissflow AI Assistant',
    closeAria: 'Close assistant',
    nudgeTitle: 'Need help finding the right doc?',
    nudgeBody: 'Ask AI for feature guides, setup steps, and API documentation.',
    nudgeDismissAria: 'Dismiss Ask AI tip',
    openAria: 'Open Ask AI assistant',
    badge: 'Ask AI ✨',
  },
};

const es: typeof en = {
  hero: {
    title: 'Todo sobre Kissflow, respondido',
    subtitle:
      'Pregunta sobre cualquier guía, API o SDK — con fuentes verificadas. O explora los artículos en las carpetas de abajo.',
    placeholder: 'Pregunta lo que quieras sobre Kissflow…',
    followUpPlaceholder: 'Haz otra pregunta…',
    askAria: 'Preguntar',
    browseFolders: 'Explorar carpetas',
    searching: 'Buscando en la documentación…',
    unavailable: 'El asistente no está disponible en este momento. Inténtalo de nuevo.',
    notFound:
      'No encontré eso en la documentación de Kissflow. Intenta reformular la pregunta o explora por rol.',
    relevantArticles: 'Artículos relevantes',
    noRelated: 'No hay artículos relacionados.',
    readMore: 'Leer más',
  },
  persona: {
    'end-users': { title: 'Usuarios finales', description: 'Envía formularios, sigue elementos, aprueba tareas y usa tableros.' },
    builders: { title: 'Creadores de flujos y apps', description: 'Diseña páginas, crea flujos de trabajo y apps sin código y con IA.' },
    admins: { title: 'Administradores', description: 'Gestiona usuarios, seguridad, SSO, gobernanza y entornos.' },
    'api-docs': { title: 'Docs de API', description: 'Referencia de la API REST — endpoints, solicitudes y respuestas.' },
    'sdk-docs': { title: 'Docs del SDK', description: 'Crea componentes personalizados con el SDK de JavaScript de Kissflow.' },
    roadmap: { title: 'Hoja de ruta', description: 'Lo que estamos construyendo en Kissflow.' },
    prerelease: { title: 'Notas previas al lanzamiento', description: 'Funciones y cambios próximos antes de su lanzamiento.' },
    announcements: { title: 'Anuncios', description: 'Cada nueva función y mejora en cuanto se publica, de la más reciente a la más antigua.' },
  },
  roadmap: {
    intro:
      'Esta hoja de ruta ofrece una mirada al futuro de Kissflow. Nuestro objetivo es mantenerte informado para que puedas planificar con eficacia y aportar los comentarios que dan forma a nuestro producto.',
    disclaimer:
      'Estos planes están sujetos a cambios y no representan un compromiso con funciones o plazos específicos.',
    yearAria: 'Año de la hoja de ruta',
    statuses: {
      shipped: 'Lanzado',
      'in-progress': 'En curso',
      planned: 'Planificado',
      deferred: 'Aplazado',
    },
  },
  prerelease: {
    intro:
      'Detalles de las funciones y cambios programados para próximas versiones de Kissflow, publicados antes del lanzamiento para que prepares tu cuenta, usuarios e integraciones.',
    disclaimer:
      'Los plazos y el alcance pueden cambiar antes del lanzamiento. Para ver las novedades ya disponibles, consulta la sección What’s New.',
    yearAria: 'Año de las notas previas al lanzamiento',
    loading: (year: string) => `Cargando las notas de ${year}…`,
    loadError: (year: string) =>
      `No se pudieron cargar las notas de ${year}. Actualiza la página e inténtalo de nuevo.`,
    note: 'nota',
    notes: 'notas',
  },
  launcher: {
    assistantTitle: 'Asistente de IA de Kissflow',
    closeAria: 'Cerrar asistente',
    nudgeTitle: '¿Necesitas ayuda para encontrar el documento correcto?',
    nudgeBody: 'Pregunta a la IA por guías de funciones, pasos de configuración y documentación de la API.',
    nudgeDismissAria: 'Descartar el consejo de Ask AI',
    openAria: 'Abrir el asistente Ask AI',
    badge: 'Ask AI ✨',
  },
};

const dictionaries = { en, es };

export type UIStrings = typeof en;

export function useUIStrings(): UIStrings {
  const { locale } = useI18n();
  return dictionaries[(locale as keyof typeof dictionaries) ?? 'en'] ?? en;
}
