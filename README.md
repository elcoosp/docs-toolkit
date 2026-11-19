<div align="center">
<img src="https://cdn.jsdelivr.net/gh/elcoosp/docs-toolkit@main/docs/logo.png" alt="docs-toolkit Logo" width="300"/>
  <p>
    <strong>A Starlight docs toolkit that verifies API references against source AST and keeps multilingual docs in parity.</strong><br/>
    Combines a Rust pipeline powered by tree-sitter with TypeScript plugins for OG images, glossaries, related pages, and Diátaxis linting. Built for maintainers of Starlight sites who need fast, deterministic docs QA without hardcoded strings.
  </p>
  <p>
    <a href="https://www.npmjs.com/package/@elcoosp/docs-toolkit"><img src="https://img.shields.io/npm/v/@elcoosp/docs-toolkit?style=flat-square" alt="npm version"/></a>
    <a href="https://github.com/elcoosp/docs-toolkit/blob/main/LICENSE"><img src="https://img.shields.io/github/license/elcoosp/docs-toolkit?style=flat-square" alt="License"/></a>
    <a href="https://starlight.astro.build"><img src="https://img.shields.io/badge/Starlight-compatible-4B32C3?style=flat-square" alt="Starlight compatible"/></a>
    <a href="https://github.com/elcoosp/docs-toolkit/tree/main/crates/docs-pipeline-rs"><img src="https://img.shields.io/badge/pipeline-Rust%20%2B%20TypeScript-orange?style=flat-square" alt="Rust and TypeScript pipeline"/></a>
  </p>
  <p>
    <a href="#quickstart">Quickstart</a> •
    <a href="#features">Features</a> •
    <a href="#how-it-works">How it works</a> •
    <a href="#usage">Usage</a> •
    <a href="#status">Status</a>
  </p>
</div>

## Quickstart

Requires Node.js 20+ and pnpm.

```bash
pnpm add @elcoosp/docs-toolkit
```

```js
// astro.config.mjs
import { defineDocsConfig } from '@elcoosp/docs-toolkit/config';

export default await defineDocsConfig({
  site: 'https://example.com',
  domain: 'example.com',
  title: 'My Docs',
  description: 'Documentation for my project',
  plugins: {
    smartTocProgress: true,
    termGlossary: true,
    i18nParity: true,
    relatedPages: true,
    diataxisLint: true,
    linkPreview: true,
    readingContext: true,
    apiDrift: { strict: false },
  },
});
```

```bash
pnpm build
```

```text
Rust pipeline completed in 12 ms — api-drift: 1,232 source symbols, 74 matched, 0 phantoms
```

## Features

- **AST-verified API references**: `api-drift` parses Rust and TypeScript with tree-sitter, flags symbols in `/reference/` pages that no longer exist in public source. No regex heuristics.
- **Multilingual parity**: `i18n-parity` ensures every key in `i18n/en.json` has a matching entry in every locale, using the conventional Starlight translation flow.
- **Diátaxis-aware linting**: `diataxis-lint` checks that pages fit one of the four documentation types and warns when a tutorial becomes reference or vice versa.
- **Fast native pipeline**: the Rust `docs-pipeline-rs` crate runs AST extraction and API indexing in parallel with rayon, adding milliseconds to a build.
- **OG images and badges**: auto-derived accent colours, per-page PNG generation, and section badges from a single `defineDocsConfig` call.
- **Discovery plugins**: related pages, term glossary, smart TOC progress, link preview, and reading context.
- **No hardcoded strings**: every user-facing message flows through `injectTranslations` and the standard `i18n/*.json` files.

## How it works

`defineDocsConfig` wires Starlight plugins into the Astro build. When the native pipeline is enabled, the Rust binary builds a public-API index from your repository using tree-sitter, then compares that index against symbols referenced in `/reference/` routes and code snippets.

```mermaid
flowchart LR
  A[Astro build] --> B[Starlight plugins]
  B --> C[Rust docs-pipeline-rs]
  C --> D[tree-sitter AST index]
  D --> E[api-drift report]
  B --> F[i18n parity]
  B --> G[Diátaxis lint]
  E --> H[Build warnings / errors]
```

The index covers `pub fn`, `pub struct`, `pub enum`, `pub trait`, enum variants, trait methods, macros, `pub use` re-exports, and TypeScript `export` declarations. The comparison respects page-level skip lists (`language`, `syntax`, `grammar`, `changelog`, etc.) and heading-level symbol extraction, so prose titles like “Construction” do not become phantom references.

## Usage

### Configuration

```js
// astro.config.mjs
import { defineDocsConfig } from '@elcoosp/docs-toolkit/config';

export default await defineDocsConfig({
  site: 'https://example.com',
  domain: 'example.com',
  title: 'My Docs',
  description: 'Documentation for my project',
  plugins: {
    apiDrift: { strict: true, writeReport: true },
    i18nParity: { defaultLocale: 'en' },
    diataxisLint: { warnOnly: false },
  },
});
```

### Individual plugins

```js
import {
  starlightSmartTocProgress,
  starlightTermGlossary,
  starlightI18nParity,
  starlightRelatedPages,
  starlightDiataxisLint,
} from '@elcoosp/docs-toolkit';

export default {
  plugins: [
    starlightSmartTocProgress(),
    starlightTermGlossary({
      entries: [{ term: 'AST', definition: 'Abstract syntax tree' }],
    }),
    starlightI18nParity(),
    starlightRelatedPages(),
    starlightDiataxisLint(),
  ],
};
```

### API drift report

```json
{
  "sourceSymbols": 1232,
  "matchedSymbols": 74,
  "coveragePct": 6,
  "phantoms": [],
  "warnings": [],
  "errors": []
}
```

The report is written to `dist/api-drift.json` when `writeReport` is enabled. Set `strict: true` to turn phantom references into build errors.

## Status

> [!NOTE]
> Stable at v1.6.9. The Rust pipeline ships prebuilt binaries for macOS, Linux, and Windows through `assets/bin`; building from source requires a Rust toolchain. TypeScript plugins target Starlight on Astro 5+. The test suite covers unit, browser, and real-site e2e projects through Vitest.

## Learn more

- [Starlight plugin source](src/plugins)
- [Rust pipeline crate](crates/docs-pipeline-rs)
