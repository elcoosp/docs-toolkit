export * from './og';
export { defineDocsConfig } from './config';
export type { DocsConfigOptions } from './config';

export { makeDocsCollection } from './config/content';

export { starlightSmartTocProgress, type SmartTocProgressOptions } from './plugins/smart-toc-progress';

export { starlightTermGlossary, type TermGlossaryOptions, type GlossaryEntry } from './plugins/term-glossary';
