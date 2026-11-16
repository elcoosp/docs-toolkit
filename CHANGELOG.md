# Changelog

## [1.1.0](https://github.com/elcoosp/docs-toolkit/compare/v1.0.1...v1.1.0) (2026-11-16)

### Features

- **config:** add DRY Diataxis topics option via starlight-sidebar-topics ([6343af5](https://github.com/elcoosp/docs-toolkit/commit/6343af56905a3274aa7a3a3d853d140602a03c2b))
- **config:** add opt-in @expressive-code/plugin-line-numbers support ([5a9a6e7](https://github.com/elcoosp/docs-toolkit/commit/5a9a6e742523c100800fb8f990fe3647a13a836b))
- **config:** canonical 4-section defaults when no sidebar override ([4610aa2](https://github.com/elcoosp/docs-toolkit/commit/4610aa297c1def227d5837a108f1fdd0fef1ce63))
- **config:** export makeDocsCollections, auto-derive logo accent fallback, fix empty sidebar override ([2faa5bd](https://github.com/elcoosp/docs-toolkit/commit/2faa5bd40462532ea53b70a01500df996d3bed30))
- **config:** integrate starlight-links-validator (mandatory) ([a445d2b](https://github.com/elcoosp/docs-toolkit/commit/a445d2b48905d0dfcdd82543888f0feca327a8bd))
- **config:** render PageActions under PageTitle, prevent Mermaid flash, auto-sync i18n ([bb18eb8](https://github.com/elcoosp/docs-toolkit/commit/bb18eb8e084d8500cfbfe8381df1e50de79d2098))
- **config:** sections option, github derivation, auto-sidebar plugin, docsMetadataCollection source ([29aef08](https://github.com/elcoosp/docs-toolkit/commit/29aef0859f86cb64bc70380528b4d4f3634f7ec9))
- **deps:** astro-takumi -&gt; npm:@elcoosp/astro-takumi@^2.1.0 (published package) ([af739d2](https://github.com/elcoosp/docs-toolkit/commit/af739d2bb47e21b69a1ecf5e8f0b0dc71c689772))
- **deps:** toolkit 0.9.0 — starlight 0.43, mermaid 12, all majors ([98d2273](https://github.com/elcoosp/docs-toolkit/commit/98d2273615aa096c9c301ceec23bbbaaaaaf4941))
- full changelog integration, OG font fixes, dev PageActions fix ([0ba677e](https://github.com/elcoosp/docs-toolkit/commit/0ba677e94091f99c7d05e13460ca85af3c9d10d2))
- **i18n:** add en/fr translations and default locales to root+fr ([4d93eb6](https://github.com/elcoosp/docs-toolkit/commit/4d93eb62d2c1691b5a47e0cb8215880fb6ba7cbd))
- **i18n:** autoTranslateSidebar with 188 FR sidebar labels ([8200ed6](https://github.com/elcoosp/docs-toolkit/commit/8200ed688ed91c725c03b68e94fc9878af84f998))
- integrate starlight-github-alerts and starlight-kbd ([d7750ae](https://github.com/elcoosp/docs-toolkit/commit/d7750ae188664c8cd7982c6856b9ad22e49d6390))
- pre-bundle starlight plugins for native astro build without tsx ([037862c](https://github.com/elcoosp/docs-toolkit/commit/037862c428d0d8e8c214c1f3cdf5bd9461d32362))
- **seo:** 0.8.4 — audit.failOn='error' (P1 complete) ([59f4f88](https://github.com/elcoosp/docs-toolkit/commit/59f4f8882bc7e9bc1d71c72e4551273e08cca8d6))
- **seo:** makeDocsCollection + full starlight-seo config, routeData 404-only ([67e5be4](https://github.com/elcoosp/docs-toolkit/commit/67e5be4779d27d4a63af14d7484c08f3b8f43d13))
- **ui:** add ChatGPT, Claude, and Gemini brand icons to Open in AI menu ([ce50289](https://github.com/elcoosp/docs-toolkit/commit/ce502899fb31cf4a7234b8533fe2501bd4eb5eda))
- **ui:** add ChatGPT, Claude, and Gemini brand icons to Open in AI menu ([009bdbc](https://github.com/elcoosp/docs-toolkit/commit/009bdbcd8bc1a30a21f0e22aca9011554bd7d130))
- **ui:** expand Open in AI dropdown with 11 AI platforms and brand icons ([cc8b700](https://github.com/elcoosp/docs-toolkit/commit/cc8b700574834deee8b1c5cd1b644d4e6d960c35))
- **ui:** use Lucide SVGs for PageActions instead of emojis ([9ff2e2b](https://github.com/elcoosp/docs-toolkit/commit/9ff2e2b049f3962b5592b9775ad6b2115e2bcf68))

### Bug Fixes

- audit disable, markdown content, remove pagetitle override ([256a137](https://github.com/elcoosp/docs-toolkit/commit/256a137efe2a6c13ff3e4847219daf0ca44f9ca2))
- **config:** compose ViewModesPageTitle and precompute AI share URLs in PageActions ([38a3a02](https://github.com/elcoosp/docs-toolkit/commit/38a3a02dbcfdfb1dcd4c2ec42aeb082b44e6383f))
- **config:** drop raw content.ts export, correct check:dist to allow config entrypoint imports ([e45d652](https://github.com/elcoosp/docs-toolkit/commit/e45d65282392518ae60421a6208e5392e8e45123))
- **config:** exclude zen-mode, presentation-mode, and 404 routes from sidebar topics ([6bced94](https://github.com/elcoosp/docs-toolkit/commit/6bced94cf4b7e8083d5d032e0ddcda530f4337e2))
- **config:** keep expressiveCode inline options JSON-serializable for &lt;Code&gt; MDX component ([f277dfc](https://github.com/elcoosp/docs-toolkit/commit/f277dfc8d6ed7dfffe0560bc6af265872787b2b5))
- **config:** load TS-only Starlight plugins via native registerHooks & Vite resolver ([7a7b814](https://github.com/elcoosp/docs-toolkit/commit/7a7b814c6ac6d082de98d9e75c74b1b372d1b0ee))
- **config:** point Learn topic link directly to first tutorial or guide ([1b614a9](https://github.com/elcoosp/docs-toolkit/commit/1b614a965442d54b30ecfc8e9b648b39447d8800))
- **config:** run starlight-sidebar-topics before auto-sidebar and map blog/changelog routes ([c4d1187](https://github.com/elcoosp/docs-toolkit/commit/c4d1187e5309fe260f6715951d12b24b6f13c95c))
- **config:** silence benign node_modules directive and sourcemap warnings in rolldown ([24c28f1](https://github.com/elcoosp/docs-toolkit/commit/24c28f17bc3955f7ac11da640f8c129eea5f4183))
- **config:** TOC layout wrapper + image zoom plugin + code cleanup ([ac45bf5](https://github.com/elcoosp/docs-toolkit/commit/ac45bf5378b3bec21804bcb1ecc10476632b49d5))
- **config:** use dynamic import for astro-takumi to avoid CJS crash in ssrLoadModule ([5a79a36](https://github.com/elcoosp/docs-toolkit/commit/5a79a3661c503446a9abf3ebfa442fe0c1e89ae0))
- **deps:** 0.9.1 — remove translations from default social ([df186c5](https://github.com/elcoosp/docs-toolkit/commit/df186c5e58eff4e35afd5a04ef4aa19326cc5f0c))
- **deps:** jsdom→linkedom (fork 2.1.1, explicit linkedom) ([659141e](https://github.com/elcoosp/docs-toolkit/commit/659141ec672fe9828fbb8bd16357f0b528aebf8e))
- **i18n:** add 'All versions' to dict (plugin-injected universal label) — release 0.5.43 ([355741f](https://github.com/elcoosp/docs-toolkit/commit/355741f6724b8aaa4df124f310e515413a33e509))
- **i18n:** restore autoTranslateSidebar import+call in config (was reverted by Phase 71) — release 0.5.42 ([933575e](https://github.com/elcoosp/docs-toolkit/commit/933575e7e9274ff35c2f8a7288a8dacee114eafe))
- **i18n:** skip string sidebar items in autoTranslateSidebar; release 0.5.39 ([e120083](https://github.com/elcoosp/docs-toolkit/commit/e12008391685d82717a685d52a10c94e828fcaea))
- **llms:** comment out invalid LLM: robots.txt directive; bump 0.9.2 ([f4ee7b7](https://github.com/elcoosp/docs-toolkit/commit/f4ee7b7cc9690fe77ddb9b2cd821365b7e074788))
- **seo:** 0.8.5 — correct TS types + passthrough schema ([bd716ac](https://github.com/elcoosp/docs-toolkit/commit/bd716acd3278f951e4997e9c9f643d63e9c22146))
- **seo:** 0.8.6 — failOn='off' (audit informational, never blocks builds) ([96881e1](https://github.com/elcoosp/docs-toolkit/commit/96881e1dfc44c29aa0d851048ab362c4c48aea6d))
- **seo:** 0.8.7 — per-rule audit (title.duplicate → warn) ([a42647a](https://github.com/elcoosp/docs-toolkit/commit/a42647a3512e3c309cb5e63d5fa061f9ec60e6d2))
- **seo:** makeDocsCollection accepts blogSchema from caller ([125ab0e](https://github.com/elcoosp/docs-toolkit/commit/125ab0e694372fa3290f002687fcc90f8fe30bfc))
- **seo:** routeData owns og:image, plugin owns graph+titles+audit ([6655828](https://github.com/elcoosp/docs-toolkit/commit/6655828eff774349e2860629cc7845917bdacc92))
- **toolkit:** TS green + majors + bins (v0.7.1) ([a564a62](https://github.com/elcoosp/docs-toolkit/commit/a564a622e0dc5ded3cd3a5a9b4e525d750d528cf))
- **ui:** avoid generic angle brackets in Astro frontmatter and add Meta AI ([ecdfb26](https://github.com/elcoosp/docs-toolkit/commit/ecdfb26f760e0aa3062338a46000d3ef6c98b17b))
- **ui:** avoid HTML tags inside script block in PageActions.astro ([f757446](https://github.com/elcoosp/docs-toolkit/commit/f757446b8d017eb5ebd6a2d3bc141d3d681af93d))
- **ui:** build full provider URLs cleanly without literal protocol mangling ([6a46feb](https://github.com/elcoosp/docs-toolkit/commit/6a46febfa5d52293a482257c08599cd3a86075bd))
- **ui:** clean up style blocks in PageActions.astro ([3723a29](https://github.com/elcoosp/docs-toolkit/commit/3723a298c07ac33b511b442142c0dd5b4e33e877))
- **ui:** ensure valid https hrefs for all AI providers in PageActions.astro ([daa6deb](https://github.com/elcoosp/docs-toolkit/commit/daa6deb39d5e0f7f457a4d3e20a7d64d14c9cd70))
- **ui:** fix AI provider query URLs in PageActions.astro ([69e4901](https://github.com/elcoosp/docs-toolkit/commit/69e4901c65ec4d790379d9ea1557d99418c1e530))
- **ui:** point GitHub Copilot link directly to /copilot/c chat ([29d6525](https://github.com/elcoosp/docs-toolkit/commit/29d652522c0ab406581800ab09eebefc4a755b24))
- **ui:** remove TS generic angle brackets in client script tag of PageActions.astro ([e41b14f](https://github.com/elcoosp/docs-toolkit/commit/e41b14fd50d21e806fbc25029b6c74152d0c1c51))
- **ui:** restore closing style tag and use unique tarball for PageActions.astro ([d1d20d3](https://github.com/elcoosp/docs-toolkit/commit/d1d20d3917d615adcc3181b995d3c008a8ae1131))
- **ui:** switch Copilot link to Microsoft Copilot ?q= chat URL ([4bbe99a](https://github.com/elcoosp/docs-toolkit/commit/4bbe99a2539196de64f62f1d7532940824ef7f90))
- **ui:** write intact AI provider URLs without chat sanitizer mangling ([8114e2a](https://github.com/elcoosp/docs-toolkit/commit/8114e2ab25dd35c2cf61f963912449076991c719))
- **vite:** exclude CJS deps from dev server optimizer (Vite 8 compat) ([82cddc9](https://github.com/elcoosp/docs-toolkit/commit/82cddc9a75a0a8facd30fff089d71a3361555662))
- **vite:** externalize @takumi-rs/core native binding, bundle wrapper via pnpm &gt; notation ([1779b00](https://github.com/elcoosp/docs-toolkit/commit/1779b00df474efaeb806e5b8749542858d48e0fa))
- **vite:** pre-bundle CJS deps to resolve 'require is not defined' in Vite 8 dev server ([87b34b6](https://github.com/elcoosp/docs-toolkit/commit/87b34b6d371791fce5ecb3d7d89d0f80e3015854))
- **vite:** remove astro-mermaid to fix Vite 8 'require is not defined' dev server crash ([8861e64](https://github.com/elcoosp/docs-toolkit/commit/8861e64cbd2cd79e885d4f88d019fc5c58b1422b))
- **vite:** remove noExternal:true (was force-bundling CJS deps causing 'require is not defined' in dev) ([638a6ab](https://github.com/elcoosp/docs-toolkit/commit/638a6abe90449a73dc5488a685a7c1b0834f8f13))
- **vite:** use esmExternalRequirePlugin to convert CJS require to ESM import for @takumi-rs/core ([442df03](https://github.com/elcoosp/docs-toolkit/commit/442df0327cb9dcc4b85a29795c6a6cf6d292e6bf))

### Performance Improvements

- **qa:** parallelize screenshots runner with built-in static server ([e141b23](https://github.com/elcoosp/docs-toolkit/commit/e141b234dec02e70c8711037a021cecb731595c4))

## 0.7.1 (2026-11-14)

### Bug Fixes

- **config:** `zenModeEnabled` → `zenModeSettings.enabled`
- **config:** `variant: 'note' as const`
- **config:** `await marked.parse(...)`
- **tsconfig:** `lib: ES2024`, `types: node,astro/client`
- **types:** `src/env.d.ts` ambient stubs for `virtual:starlight-*`, `starlight-view-modes`, `starlight-telescope` (no runtime change)
- **postbuild:** unconditional shebang + `chmod 0o755` + bare bin paths

### Dependencies

- **major:** `marked` 15 → 18
- **major:** `mermaid` 11 → 12
- **major:** `@types/node` 24 → 26
- **major:** `typescript` 6 → 7
- **minor:** `@astrojs/rss` → `^4.0.19`, `tsx` → `^4.23.15`, `zod` → `^4.6.7`
- **pin:** `starlight-heading-badges` `*` → `^0.8.0`

`pnpm typecheck` is now green.

## 0.7.0 (2026-11-14)

### Features

- **config:** integrate `starlight-links-validator` as a mandatory plugin — production builds now fail on broken internal links (no opt-out)
- **config:** honor `options.plugins` in the merged plugin array (previously destructured but silently discarded)

### Bug Fixes

- **config:** wire `options.plugins` into `mergedPlugins`
- **repo:** remove stale `src/config/index.ts.bak`

## [1.0.1](https://github.com/elcoosp/docs-toolkit/compare/v1.0.0...v1.0.1) (2026-11-12)

### Bug Fixes

- trigger release-please to test the workflow ([fec062a](https://github.com/elcoosp/docs-toolkit/commit/fec062abe657cc8fa9b894dbfccff33a18a3ced4))

## 1.0.0 (2026-11-12)

### ⚠ BREAKING CHANGES

- migrate docs-toolkit to TypeScript, build with tsdown

### Features

- add linux_deps for GUI builds ([b6459bb](https://github.com/elcoosp/docs-toolkit/commit/b6459bbbb99ec85736451c6835ff5c4335cd3e93))
- **changelog:** add GitHub metadata (PRs, authors, SHAs, compare links) ([0ad2945](https://github.com/elcoosp/docs-toolkit/commit/0ad29456e40994378f23c30783ca576fb15b7e2c))
- **changelog:** collapsible UI with &lt;details&gt; elements ([79a2a0b](https://github.com/elcoosp/docs-toolkit/commit/79a2a0b02e9368ebd516effa31d6773dbc34479b))
- **changelog:** reusable workflow + emoji-free canonical config ([f4bacb1](https://github.com/elcoosp/docs-toolkit/commit/f4bacb1e531233d5d1fe5cca32c46d85a80ed343))
- **ci:** add reusable release-please workflow ([6904922](https://github.com/elcoosp/docs-toolkit/commit/6904922b654433dfc50a0836df77f945672f7182))
- **ci:** enable OIDC for release-plz ([dad4fac](https://github.com/elcoosp/docs-toolkit/commit/dad4facea9630f6d4171c4bb0736b9fdc2b671ed))
- drop starlight-llms-txt (ships raw .ts, incompatible with Node 24 native loader); llms.txt is consumer-managed ([5f81909](https://github.com/elcoosp/docs-toolkit/commit/5f81909ef959d9ea743bbaf54013280addc91d06))
- **git-cliff:** canonical cliff.toml for whole fleet ([e33bd23](https://github.com/elcoosp/docs-toolkit/commit/e33bd2348f00a50c130d34186407b7ba007315c0))
- initial @elcoosp/docs-toolkit v0.1.0 ([cda97a6](https://github.com/elcoosp/docs-toolkit/commit/cda97a6fa73cfddaa79615819c0a2301d46d7d56))
- **llms:** state-of-the-art native llms.txt generator (json, small, page twins, head link) ([353ad96](https://github.com/elcoosp/docs-toolkit/commit/353ad96e45ac0a0ed36fd4869fab36cdbca6475d))
- **og:** bigger logo (120→160) and name (40→52), 0.3.0 ([8084231](https://github.com/elcoosp/docs-toolkit/commit/8084231ffe3841ce1f199644aeb0c0af71b137bb))
- **og:** breadcrumb skip on home, static 404-card.png fallback, 0.2.2 ([154b369](https://github.com/elcoosp/docs-toolkit/commit/154b3696185d774c0d77653eefc49bdaee33c161))
- **og:** JSON-LD TechArticle+BreadcrumbList, skip og:image on 404, bump 0.2.0 ([5d09cb3](https://github.com/elcoosp/docs-toolkit/commit/5d09cb3436a267e3ba3f252c58bb4c707f1eefb3))
- **og:** remove version stamp from image footer ([dd2fa6d](https://github.com/elcoosp/docs-toolkit/commit/dd2fa6d7981534c0e3b230f4eed59e38bd51e4e5))
- **release:** adopt release-plz (v0.5.x) — best-practice release flow ([5d0e9cf](https://github.com/elcoosp/docs-toolkit/commit/5d0e9cf8f6f97410601f35833567a160cb0b1a4c))
- **release:** unified rust + js release workflows ([b2a4aa3](https://github.com/elcoosp/docs-toolkit/commit/b2a4aa301671ff30db804f525b25e02ae27cf2f9))
- **ui:** add seo, mermaid, blog, giscus, and custom page actions ([93907d9](https://github.com/elcoosp/docs-toolkit/commit/93907d9a98f1d9119b17abda6bc46a21ab912a1a))
- **ui:** integrate high-impact Starlight plugins for product polish ([366fd96](https://github.com/elcoosp/docs-toolkit/commit/366fd96a041b8a5d342913af9c35a1f00d2834eb))

### Bug Fixes

- **build:** bundle starlight-llms-txt and copy its route file to dist ([597e376](https://github.com/elcoosp/docs-toolkit/commit/597e376d9faa880af7096bae230caa0b38043a0a))
- **build:** bundle starlight-llms-txt and ship its route file ([42a7a37](https://github.com/elcoosp/docs-toolkit/commit/42a7a37ffad93506d2433d0cd561fea017ee0707))
- **build:** bundle starlight-llms-txt into dist for Node 24 ([8af4039](https://github.com/elcoosp/docs-toolkit/commit/8af40398cb3c21d5d331a7732e3afebe0f26c048))
- **build:** copy all llms route files into dist; fix rss.mjs location ([f0806ed](https://github.com/elcoosp/docs-toolkit/commit/f0806edbf59ed4d73f8258af300632a17b57e516))
- **build:** copy full .ts dependency chain from plugin into dist ([6d76923](https://github.com/elcoosp/docs-toolkit/commit/6d76923a7901421615cb3c6673ffd2a096070dfe))
- **build:** copy llms-custom.txt.ts into dist for bundled plugin ([837618d](https://github.com/elcoosp/docs-toolkit/commit/837618d49cad58456dae5a2187186949c9237057))
- **build:** starlight-llms-txt as runtime dep so alwaysBundle actually bundles it ([2a50b87](https://github.com/elcoosp/docs-toolkit/commit/2a50b8798540da2542676787fc4be5b7d68cb237))
- **changelog:** add required type='overview' to StarlightPage frontmatter ([0a527ea](https://github.com/elcoosp/docs-toolkit/commit/0a527ea6c8a24096982b9d6df829ab1c8bdb04d5))
- **changelog:** bypass Starlight sidebar validation for injected page ([b284ff4](https://github.com/elcoosp/docs-toolkit/commit/b284ff4d0f4d644320c074406386e84dc699347e))
- **changelog:** changelog-only mode + additive templates ([9bdf9e5](https://github.com/elcoosp/docs-toolkit/commit/9bdf9e5cf298b69d852a8666abb7a789e7e58fea))
- **changelog:** inject repo name into config dynamically ([6e768d3](https://github.com/elcoosp/docs-toolkit/commit/6e768d379311e6a3fdafe07ca491ddc3c88ade5a))
- **changelog:** inject repo name via sed (YAML-safe) ([ee258f4](https://github.com/elcoosp/docs-toolkit/commit/ee258f4b061820e0bbda7aa2e06359a02cbfd4ee))
- **changelog:** space between author and SHA link (whitespace control) ([15864a8](https://github.com/elcoosp/docs-toolkit/commit/15864a869a37f377d2aa456eadf66d5591ed8b02))
- **changelog:** Starlight only allows tutorial|how-to|reference|explanation for type ([ac684a4](https://github.com/elcoosp/docs-toolkit/commit/ac684a44763db62ceb30ca70e89e430d9cc04049))
- **changelog:** walk up from import.meta.url to find page.astro ([cb63ff3](https://github.com/elcoosp/docs-toolkit/commit/cb63ff3540be90c7c393f0980981143dfcec93c8))
- **changelog:** warn+skip on missing CHANGELOG.md (exact-string, no template-literal regex) ([a132815](https://github.com/elcoosp/docs-toolkit/commit/a1328154b34662d452695bbcbe6ff5d185a0c652))
- **changelog:** warn+skip on missing CHANGELOG.md instead of throwing ([23ce550](https://github.com/elcoosp/docs-toolkit/commit/23ce55053204c0ed9a66b70f33d1359c75c7beb3))
- **ci:** fetch release-plz.toml via git+raw.githubusercontent (no API rate limit) ([907a553](https://github.com/elcoosp/docs-toolkit/commit/907a55342dc3a802a2546814c442b20ac09c4e62))
- **ci:** remove malformed secrets block and use RELEASE_PLZ_TOKEN ([dce38d6](https://github.com/elcoosp/docs-toolkit/commit/dce38d63054adb35497a700034c477b86ba1b143))
- **ci:** repair permissions YAML and enable OIDC trusted publishing for release-plz ([63b5626](https://github.com/elcoosp/docs-toolkit/commit/63b56267630c172c74f8b4287ca11bfd494b25e2))
- **ci:** rewrite release-plz.yml cleanly to fix workflow parser error ([d9f543a](https://github.com/elcoosp/docs-toolkit/commit/d9f543ac41b9362a2a22b7f1add9eeb14139c792))
- **ci:** use github.token for fetch/release, PAT only for release-pr ([3b524b7](https://github.com/elcoosp/docs-toolkit/commit/3b524b750820b98782d7263d5f6fe3fa66c3a53a))
- **ci:** use jq instead of python3 for workspace listing ([b117261](https://github.com/elcoosp/docs-toolkit/commit/b117261f237333204b8eb17675ef008bd50aac77))
- **config:** commit bare PageActions.astro path (aligns git with shipped 0.5.3+) ([28b6a4b](https://github.com/elcoosp/docs-toolkit/commit/28b6a4b2cff704aceb57a0669e8da87d9897f212))
- **config:** embed roboto font as base64 (tsdown chunk hashing breaks relative paths) ([22eb4ca](https://github.com/elcoosp/docs-toolkit/commit/22eb4ca5f9e6f1f883488a6233ab49a41f830d35))
- **config:** inline roboto font via base64 (was reading from non-shipped assets/) ([f653391](https://github.com/elcoosp/docs-toolkit/commit/f653391a3c7ea11494a7234ccf7455cc02c9258a))
- **config:** restore destructure, fix duplicate sidebarWithChangelog ([a1dc907](https://github.com/elcoosp/docs-toolkit/commit/a1dc90778b6576c20e49a5f0500dd71d57e135b4))
- **exports:** expose ./PageActions.astro alias (bare form used by src/config/index.ts) ([fdeb167](https://github.com/elcoosp/docs-toolkit/commit/fdeb167ca0204868df3f23da55d14c95b117a975))
- **exports:** preserve ./src/* subpath in postbuild (PageActions, llms, changelog) ([aa857d1](https://github.com/elcoosp/docs-toolkit/commit/aa857d1ef355f1cd1169c33366e9a0c4ec8622da))
- **llms:** import renderFull in small.ts ([3464b8b](https://github.com/elcoosp/docs-toolkit/commit/3464b8bf304b5030d25ae72328c2fe3863ffd881))
- **llms:** public return types (TS4058) — StarlightPlugin + AstroIntegration ([0bd06d1](https://github.com/elcoosp/docs-toolkit/commit/0bd06d101a300b08495f165218ac24dd7291bd89))
- **og:** 404 pages get og:image again (astro-takumi extract() requires it), keep JSON-LD skip on 404 ([8a49090](https://github.com/elcoosp/docs-toolkit/commit/8a490901e1514378819bee3ff7740249c80fe7ec))
- **og:** restore TechArticle push (regex ate it in ab323a5), keep breadcrumb home-skip, 0.2.3 ([bb8119e](https://github.com/elcoosp/docs-toolkit/commit/bb8119efd1a42f6b9910057d09c9d314ff544459))
- **og:** revert 404-card override (404.png was already fine); keep home-breadcrumb skip ([ab323a5](https://github.com/elcoosp/docs-toolkit/commit/ab323a5ec4bb86861536224ec8f83e5f958b29a1))
- **peer:** declare mermaid as peerDependency (astro-mermaid client import) ([b3ad292](https://github.com/elcoosp/docs-toolkit/commit/b3ad292021805a734a6e491307c73a3dbe9a08f5))
- **postbuild:** remove broken fs.existsSync block that used un-imported fs ([495dc02](https://github.com/elcoosp/docs-toolkit/commit/495dc0287869f42f9ffed64fd918f754378c719f))
- re-enable git_only = true (path deps now fixed) ([c03c86c](https://github.com/elcoosp/docs-toolkit/commit/c03c86c6f142d277fad174d13dd49c578c1a77a9))
- **release-plz:** actually replace fetch step with gh api ([0ff606b](https://github.com/elcoosp/docs-toolkit/commit/0ff606beff4c2754e840d3c48c1fe63ac4b3db8e))
- **release-plz:** add --git-token and --forge github flags ([08ae62b](https://github.com/elcoosp/docs-toolkit/commit/08ae62b86d56479f1709c40d05d03d91e6da9014))
- **release-plz:** correct dry_run semantics ([a4925d3](https://github.com/elcoosp/docs-toolkit/commit/a4925d3f6f540064d3a757b978af939b9ffe5ef1))
- **release-plz:** definitively remove footer field ([2844447](https://github.com/elcoosp/docs-toolkit/commit/28444472a7e4d5e7b25c739b382f8d1d8bff784c))
- **release-plz:** disable semver_check for unpublished packages ([f25ad9b](https://github.com/elcoosp/docs-toolkit/commit/f25ad9b2614639dfa88602102f7d398f22299c84))
- **release-plz:** fetch config via gh api (cache-free) ([0df18d2](https://github.com/elcoosp/docs-toolkit/commit/0df18d25d006d6b23653d4998a6fed08667e3ef5))
- **release-plz:** git_only = true — use git tags as version baseline ([f565ddc](https://github.com/elcoosp/docs-toolkit/commit/f565ddcf5f64c28841348b33e21a76394753c0f0))
- **release-plz:** pass GH_TOKEN as required secret, force --forge/--git-token on release ([38b940e](https://github.com/elcoosp/docs-toolkit/commit/38b940e015a50a4b433aa6f1bd64765664ecbba7))
- **release-plz:** remove [[package]] from shared config ([a562192](https://github.com/elcoosp/docs-toolkit/commit/a56219234cc3833e5c6eef7f46dfd388fcdcfb7c))
- **release-plz:** rewrite workflow cleanly (no duplicate GH_TOKEN) ([02725ca](https://github.com/elcoosp/docs-toolkit/commit/02725ca1b16798916a48a6c8a4720cd5c73bcb70))
- **release-plz:** SHA-pinned config fetch to bypass CDN staleness ([a597fab](https://github.com/elcoosp/docs-toolkit/commit/a597fab496987039f3a982e14c60ab5d45e613d1))
- **release-plz:** skip unpublished internal crates ([b36bb74](https://github.com/elcoosp/docs-toolkit/commit/b36bb7474252f86bb616d015ee87ced43b249409))
- **template:** prefer RELEASE_PLZ_TOKEN over GITHUB_TOKEN ([853962a](https://github.com/elcoosp/docs-toolkit/commit/853962a2648741c740aed0558ff57f48746394dc))
- trigger initial release-please PR for OIDC verification ([23afee4](https://github.com/elcoosp/docs-toolkit/commit/23afee47139a6649d326d0121dd8b10a09d4fbf7))
- **types:** zero typecheck errors — Page.text field, fail() block body ([9e0e4cb](https://github.com/elcoosp/docs-toolkit/commit/9e0e4cb608a53d1dfdc6e111f2b499ea58fc7daf))
- **ui:** remove pluginCollapsible (Astro requires ec.config.mjs for functions) ([aed4c39](https://github.com/elcoosp/docs-toolkit/commit/aed4c39da3e461b4ce803e7f2845a5e36bb7ed21))
- **vite:** externalize starlight-llms-txt but transform via noExternal ([f4aaa18](https://github.com/elcoosp/docs-toolkit/commit/f4aaa181941a71cfb98ac186579d5fbfd393a8ef))
- 规范 release-plz.toml 配置 ([ab9b161](https://github.com/elcoosp/docs-toolkit/commit/ab9b161027a428c9ed70d7481b30812ae033f8d9))

### Performance Improvements

- add rust-cache@v2 and debug logs to release-plz ([0864328](https://github.com/elcoosp/docs-toolkit/commit/0864328500d0728d55d652ac13b9a3d55df2fce8))
- **release-plz:** add rust-cache, timeout, debug logs ([d48fed3](https://github.com/elcoosp/docs-toolkit/commit/d48fed35ab775705e6eb7dcc6095c3b1e5d99459))
- **release-plz:** lightweight dry-run preview (skip heavy update) ([0f400c2](https://github.com/elcoosp/docs-toolkit/commit/0f400c2b043664e69c5b688372ba480443ff257a))

### Reverts

- restore starlight-llms-txt bundling (required — plugin ships raw .ts) ([fb46a9f](https://github.com/elcoosp/docs-toolkit/commit/fb46a9f550f2b6d6f98819c5a2f7ec922f6550d6))

### Code Refactoring

- migrate docs-toolkit to TypeScript, build with tsdown ([1b1866f](https://github.com/elcoosp/docs-toolkit/commit/1b1866f8ecd7aa448d6cc17b903b532545ba771d))
