import type { StarlightIcon } from '@astrojs/starlight/types';

export { default as DiataxisGrid } from './DiataxisGrid.astro';

export type { StarlightIcon };

export interface DiataxisItem {
  title: string;
  description: string;
  href: string;
  icon?: StarlightIcon;
  badge?: string;
}
