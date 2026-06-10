export type PersonaId =
  | 'end-user'
  | 'citizen-developer'
  | 'admin'
  | 'pro-developer'
  | 'shared';

interface PersonaConfig {
  label: string;
  promptFrame: string;
}

export const personas: Record<PersonaId, PersonaConfig> = {
  'end-user': {
    label: 'End User',
    promptFrame:
      'Help me complete this task in Kissflow. Walk me through it one step at a time.',
  },
  'citizen-developer': {
    label: 'Workflow & App Builder',
    promptFrame:
      'Help me apply this page to my use case, quoting formula syntax, field types, and workflow conditions exactly as documented.',
  },
  admin: {
    label: 'Admin',
    promptFrame:
      'Help me configure this in my Kissflow account. Note any security or governance implications.',
  },
  'pro-developer': {
    label: 'Developer',
    promptFrame:
      'Answer with exact endpoint paths, parameters, and response fields. If something is ambiguous or undocumented, say so explicitly instead of guessing.',
  },
  shared: {
    label: 'All Users',
    promptFrame:
      'Help me understand this Kissflow feature. Explain clearly and suggest next steps.',
  },
};

export function personaFromPath(path: string): PersonaId {
  if (path.startsWith('/docs/use/')) return 'end-user';
  if (path.startsWith('/docs/build/')) return 'citizen-developer';
  if (path.startsWith('/docs/admin/')) return 'admin';
  if (path.startsWith('/docs/develop/')) return 'pro-developer';
  return 'shared';
}
