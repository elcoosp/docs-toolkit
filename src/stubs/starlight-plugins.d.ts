declare module 'starlight-heading-badges' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightHeadingBadges(): StarlightPlugin;
}
declare module 'starlight-telescope' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightTelescope(opts?: Record<string, unknown>): StarlightPlugin;
}
declare module 'starlight-view-modes' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightViewModes(opts?: Record<string, unknown>): StarlightPlugin;
}
declare module 'starlight-changelogs' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightChangelogs(opts?: Record<string, unknown>): StarlightPlugin;
  export function makeChangelogsSidebarLinks(opts?: unknown): any[];
}
declare module 'starlight-auto-sidebar' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightAutoSidebar(opts?: Record<string, unknown>): StarlightPlugin;
}
declare module 'starlight-blog' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightBlog(opts?: Record<string, unknown>): StarlightPlugin;
}
declare module 'starlight-image-zoom' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightImageZoom(opts?: Record<string, unknown>): StarlightPlugin;
}
declare module 'starlight-github-alerts' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightGitHubAlerts(): StarlightPlugin;
}
declare module 'starlight-kbd' {
  import type { StarlightPlugin } from '@astrojs/starlight/types';
  export default function starlightKbd(opts: Record<string, unknown>): StarlightPlugin;
}
