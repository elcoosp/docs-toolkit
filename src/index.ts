export * from './og';
export { defineDocsConfig } from './config';
export type { DocsConfigOptions } from './config';

export { makeDocsCollection } from './config/content';

export { starlightSmartTocProgress, type SmartTocProgressOptions } from './plugins/smart-toc-progress';

export { starlightTermGlossary, type TermGlossaryOptions, type GlossaryEntry } from './plugins/term-glossary';

export { starlightI18nParity, type I18nParityOptions } from './plugins/i18n-parity';

export { starlightRelatedPages, type RelatedPagesOptions } from './plugins/related-pages';

export { starlightDiataxisLint, type DiataxisLintOptions } from './plugins/diataxis-lint';
