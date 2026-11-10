# @elcoosp/docs-toolkit

Shared OG image generation, docs config helper, and QA tooling for Starlight sites.

Install: `"@elcoosp/docs-toolkit": "github:elcoosp/docs-toolkit#<sha>"`

astro.config.mjs:
```js
import { defineDocsConfig } from '@elcoosp/docs-toolkit/config';
export default await defineDocsConfig({ site, domain, title, description, plugins, sidebar });
```

src/routeData.mjs:
```js
export { onRequest } from '@elcoosp/docs-toolkit/og/routeData';
```

Features: auto-derived accent, per-page OG PNGs, section badges, config wrapper with `extraStarlight`/`extraIntegrations`/`extraVite`/`accentOverride` hooks.
