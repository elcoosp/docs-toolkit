// Centralized FR translations for common sidebar labels.
// Used by autoTranslateSidebar() in defineDocsConfig. Site-provided
// translations always win; this is a fallback for untranslated labels.
export const SIDEBAR_LABEL_FR: Record<string, string> = {
  'Architecture': 'Architecture',
  'CLI': 'CLI',
  'Changelog': 'Journal des modifications',
  'Concepts': 'Concepts',
  'Crates': 'Crates',
  'Errors': 'Erreurs',
  'Explanation': 'Explication',
  'Feature flags': 'Drapeaux de fonctionnalités',
  'Guides': 'Guides',
  'How-to Guides': 'Guides pratiques',
  'How-to guides': 'Guides pratiques',
  'Installation': 'Installation',
  'Macros': 'Macros',
  'Overview': 'Aperçu',
  'Reference': 'Référence',
  'Tutorials': 'Tutoriels',
};

/**
 * Walk a sidebar (or any label/items tree) and inject fr translations
 * for any label that has no translations.fr and matches the dictionary.
 * Site-provided translations are never overwritten.
 */
export function autoTranslateSidebar<T>(sidebar: T): T {
  if (!Array.isArray(sidebar)) return sidebar;
  return sidebar.map((item: any) => {
    if (typeof item === 'string') return item;
    const result: any = { ...item };
    if (typeof result.label === 'string' && !result.translations?.fr) {
      const fr = SIDEBAR_LABEL_FR[result.label];
      if (fr) {
        result.translations = { ...(result.translations ?? {}), fr };
      }
    }
    if (Array.isArray(result.items)) {
      result.items = autoTranslateSidebar(result.items);
    }
    return result;
  }) as unknown as T;
}
