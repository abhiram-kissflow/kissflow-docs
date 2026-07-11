export const DOCS_COACHMARK_SESSION_KEY = 'kissflow-docs-coachmark-dismissed';

export function shouldShowDocsCoachmark(value: string | null): boolean {
  return value !== 'dismissed';
}
