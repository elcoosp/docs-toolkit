import type { StarlightIcon } from '@astrojs/starlight/types';

export interface DiataxisItem {
  quadrant: 'tutorials' | 'how-to' | 'reference' | 'explanation';
  title: string;
  description: string;
  href: string;
  badge?: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  icon?: StarlightIcon;
  badge?: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export { default as DiataxisGrid } from './DiataxisGrid.astro';
export { default as FeatureGrid } from './FeatureGrid.astro';
export { default as StatStrip } from './StatStrip.astro';
