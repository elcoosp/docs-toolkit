import './ts-loader.js';

const mod = await import('./config-impl.js');

export const defineDocsConfig = mod.defineDocsConfig;
export type * from './config-impl.js';
