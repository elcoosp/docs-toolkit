export { default as DiataxisGrid } from './DiataxisGrid.astro';

export interface DiataxisItem {
  title: string;
  description: string;
  href: string;
  icon?: 'rocket' | 'puzzle' | 'open-book' | 'information' | 'document' | 'terminal' | 'laptop' | 'approve-check' | 'code-branch' | 'setting' | 'star' | 'magnifier';
  badge?: string;
}
