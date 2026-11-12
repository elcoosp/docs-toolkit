# Changelog

## [1.0.1](https://github.com/elcoosp/docs-toolkit/compare/v1.0.0...v1.0.1) (2026-11-12)


### Bug Fixes

* trigger release-please to test the workflow ([fec062a](https://github.com/elcoosp/docs-toolkit/commit/fec062abe657cc8fa9b894dbfccff33a18a3ced4))

## 1.0.0 (2026-11-12)


### ⚠ BREAKING CHANGES

* migrate docs-toolkit to TypeScript, build with tsdown

### Features

* add linux_deps for GUI builds ([b6459bb](https://github.com/elcoosp/docs-toolkit/commit/b6459bbbb99ec85736451c6835ff5c4335cd3e93))
* **changelog:** add GitHub metadata (PRs, authors, SHAs, compare links) ([0ad2945](https://github.com/elcoosp/docs-toolkit/commit/0ad29456e40994378f23c30783ca576fb15b7e2c))
* **changelog:** collapsible UI with &lt;details&gt; elements ([79a2a0b](https://github.com/elcoosp/docs-toolkit/commit/79a2a0b02e9368ebd516effa31d6773dbc34479b))
* **changelog:** reusable workflow + emoji-free canonical config ([f4bacb1](https://github.com/elcoosp/docs-toolkit/commit/f4bacb1e531233d5d1fe5cca32c46d85a80ed343))
* **ci:** add reusable release-please workflow ([6904922](https://github.com/elcoosp/docs-toolkit/commit/6904922b654433dfc50a0836df77f945672f7182))
* **ci:** enable OIDC for release-plz ([dad4fac](https://github.com/elcoosp/docs-toolkit/commit/dad4facea9630f6d4171c4bb0736b9fdc2b671ed))
* drop starlight-llms-txt (ships raw .ts, incompatible with Node 24 native loader); llms.txt is consumer-managed ([5f81909](https://github.com/elcoosp/docs-toolkit/commit/5f81909ef959d9ea743bbaf54013280addc91d06))
* **git-cliff:** canonical cliff.toml for whole fleet ([e33bd23](https://github.com/elcoosp/docs-toolkit/commit/e33bd2348f00a50c130d34186407b7ba007315c0))
* initial @elcoosp/docs-toolkit v0.1.0 ([cda97a6](https://github.com/elcoosp/docs-toolkit/commit/cda97a6fa73cfddaa79615819c0a2301d46d7d56))
* **llms:** state-of-the-art native llms.txt generator (json, small, page twins, head link) ([353ad96](https://github.com/elcoosp/docs-toolkit/commit/353ad96e45ac0a0ed36fd4869fab36cdbca6475d))
* **og:** bigger logo (120→160) and name (40→52), 0.3.0 ([8084231](https://github.com/elcoosp/docs-toolkit/commit/8084231ffe3841ce1f199644aeb0c0af71b137bb))
* **og:** breadcrumb skip on home, static 404-card.png fallback, 0.2.2 ([154b369](https://github.com/elcoosp/docs-toolkit/commit/154b3696185d774c0d77653eefc49bdaee33c161))
* **og:** JSON-LD TechArticle+BreadcrumbList, skip og:image on 404, bump 0.2.0 ([5d09cb3](https://github.com/elcoosp/docs-toolkit/commit/5d09cb3436a267e3ba3f252c58bb4c707f1eefb3))
* **og:** remove version stamp from image footer ([dd2fa6d](https://github.com/elcoosp/docs-toolkit/commit/dd2fa6d7981534c0e3b230f4eed59e38bd51e4e5))
* **release:** adopt release-plz (v0.5.x) — best-practice release flow ([5d0e9cf](https://github.com/elcoosp/docs-toolkit/commit/5d0e9cf8f6f97410601f35833567a160cb0b1a4c))
* **release:** unified rust + js release workflows ([b2a4aa3](https://github.com/elcoosp/docs-toolkit/commit/b2a4aa301671ff30db804f525b25e02ae27cf2f9))
* **ui:** add seo, mermaid, blog, giscus, and custom page actions ([93907d9](https://github.com/elcoosp/docs-toolkit/commit/93907d9a98f1d9119b17abda6bc46a21ab912a1a))
* **ui:** integrate high-impact Starlight plugins for product polish ([366fd96](https://github.com/elcoosp/docs-toolkit/commit/366fd96a041b8a5d342913af9c35a1f00d2834eb))


### Bug Fixes

* **build:** bundle starlight-llms-txt and copy its route file to dist ([597e376](https://github.com/elcoosp/docs-toolkit/commit/597e376d9faa880af7096bae230caa0b38043a0a))
* **build:** bundle starlight-llms-txt and ship its route file ([42a7a37](https://github.com/elcoosp/docs-toolkit/commit/42a7a37ffad93506d2433d0cd561fea017ee0707))
* **build:** bundle starlight-llms-txt into dist for Node 24 ([8af4039](https://github.com/elcoosp/docs-toolkit/commit/8af40398cb3c21d5d331a7732e3afebe0f26c048))
* **build:** copy all llms route files into dist; fix rss.mjs location ([f0806ed](https://github.com/elcoosp/docs-toolkit/commit/f0806edbf59ed4d73f8258af300632a17b57e516))
* **build:** copy full .ts dependency chain from plugin into dist ([6d76923](https://github.com/elcoosp/docs-toolkit/commit/6d76923a7901421615cb3c6673ffd2a096070dfe))
* **build:** copy llms-custom.txt.ts into dist for bundled plugin ([837618d](https://github.com/elcoosp/docs-toolkit/commit/837618d49cad58456dae5a2187186949c9237057))
* **build:** starlight-llms-txt as runtime dep so alwaysBundle actually bundles it ([2a50b87](https://github.com/elcoosp/docs-toolkit/commit/2a50b8798540da2542676787fc4be5b7d68cb237))
* **changelog:** add required type='overview' to StarlightPage frontmatter ([0a527ea](https://github.com/elcoosp/docs-toolkit/commit/0a527ea6c8a24096982b9d6df829ab1c8bdb04d5))
* **changelog:** bypass Starlight sidebar validation for injected page ([b284ff4](https://github.com/elcoosp/docs-toolkit/commit/b284ff4d0f4d644320c074406386e84dc699347e))
* **changelog:** changelog-only mode + additive templates ([9bdf9e5](https://github.com/elcoosp/docs-toolkit/commit/9bdf9e5cf298b69d852a8666abb7a789e7e58fea))
* **changelog:** inject repo name into config dynamically ([6e768d3](https://github.com/elcoosp/docs-toolkit/commit/6e768d379311e6a3fdafe07ca491ddc3c88ade5a))
* **changelog:** inject repo name via sed (YAML-safe) ([ee258f4](https://github.com/elcoosp/docs-toolkit/commit/ee258f4b061820e0bbda7aa2e06359a02cbfd4ee))
* **changelog:** space between author and SHA link (whitespace control) ([15864a8](https://github.com/elcoosp/docs-toolkit/commit/15864a869a37f377d2aa456eadf66d5591ed8b02))
* **changelog:** Starlight only allows tutorial|how-to|reference|explanation for type ([ac684a4](https://github.com/elcoosp/docs-toolkit/commit/ac684a44763db62ceb30ca70e89e430d9cc04049))
* **changelog:** walk up from import.meta.url to find page.astro ([cb63ff3](https://github.com/elcoosp/docs-toolkit/commit/cb63ff3540be90c7c393f0980981143dfcec93c8))
* **changelog:** warn+skip on missing CHANGELOG.md (exact-string, no template-literal regex) ([a132815](https://github.com/elcoosp/docs-toolkit/commit/a1328154b34662d452695bbcbe6ff5d185a0c652))
* **changelog:** warn+skip on missing CHANGELOG.md instead of throwing ([23ce550](https://github.com/elcoosp/docs-toolkit/commit/23ce55053204c0ed9a66b70f33d1359c75c7beb3))
* **ci:** fetch release-plz.toml via git+raw.githubusercontent (no API rate limit) ([907a553](https://github.com/elcoosp/docs-toolkit/commit/907a55342dc3a802a2546814c442b20ac09c4e62))
* **ci:** remove malformed secrets block and use RELEASE_PLZ_TOKEN ([dce38d6](https://github.com/elcoosp/docs-toolkit/commit/dce38d63054adb35497a700034c477b86ba1b143))
* **ci:** repair permissions YAML and enable OIDC trusted publishing for release-plz ([63b5626](https://github.com/elcoosp/docs-toolkit/commit/63b56267630c172c74f8b4287ca11bfd494b25e2))
* **ci:** rewrite release-plz.yml cleanly to fix workflow parser error ([d9f543a](https://github.com/elcoosp/docs-toolkit/commit/d9f543ac41b9362a2a22b7f1add9eeb14139c792))
* **ci:** use github.token for fetch/release, PAT only for release-pr ([3b524b7](https://github.com/elcoosp/docs-toolkit/commit/3b524b750820b98782d7263d5f6fe3fa66c3a53a))
* **ci:** use jq instead of python3 for workspace listing ([b117261](https://github.com/elcoosp/docs-toolkit/commit/b117261f237333204b8eb17675ef008bd50aac77))
* **config:** commit bare PageActions.astro path (aligns git with shipped 0.5.3+) ([28b6a4b](https://github.com/elcoosp/docs-toolkit/commit/28b6a4b2cff704aceb57a0669e8da87d9897f212))
* **config:** embed roboto font as base64 (tsdown chunk hashing breaks relative paths) ([22eb4ca](https://github.com/elcoosp/docs-toolkit/commit/22eb4ca5f9e6f1f883488a6233ab49a41f830d35))
* **config:** inline roboto font via base64 (was reading from non-shipped assets/) ([f653391](https://github.com/elcoosp/docs-toolkit/commit/f653391a3c7ea11494a7234ccf7455cc02c9258a))
* **config:** restore destructure, fix duplicate sidebarWithChangelog ([a1dc907](https://github.com/elcoosp/docs-toolkit/commit/a1dc90778b6576c20e49a5f0500dd71d57e135b4))
* **exports:** expose ./PageActions.astro alias (bare form used by src/config/index.ts) ([fdeb167](https://github.com/elcoosp/docs-toolkit/commit/fdeb167ca0204868df3f23da55d14c95b117a975))
* **exports:** preserve ./src/* subpath in postbuild (PageActions, llms, changelog) ([aa857d1](https://github.com/elcoosp/docs-toolkit/commit/aa857d1ef355f1cd1169c33366e9a0c4ec8622da))
* **llms:** import renderFull in small.ts ([3464b8b](https://github.com/elcoosp/docs-toolkit/commit/3464b8bf304b5030d25ae72328c2fe3863ffd881))
* **llms:** public return types (TS4058) — StarlightPlugin + AstroIntegration ([0bd06d1](https://github.com/elcoosp/docs-toolkit/commit/0bd06d101a300b08495f165218ac24dd7291bd89))
* **og:** 404 pages get og:image again (astro-takumi extract() requires it), keep JSON-LD skip on 404 ([8a49090](https://github.com/elcoosp/docs-toolkit/commit/8a490901e1514378819bee3ff7740249c80fe7ec))
* **og:** restore TechArticle push (regex ate it in ab323a5), keep breadcrumb home-skip, 0.2.3 ([bb8119e](https://github.com/elcoosp/docs-toolkit/commit/bb8119efd1a42f6b9910057d09c9d314ff544459))
* **og:** revert 404-card override (404.png was already fine); keep home-breadcrumb skip ([ab323a5](https://github.com/elcoosp/docs-toolkit/commit/ab323a5ec4bb86861536224ec8f83e5f958b29a1))
* **peer:** declare mermaid as peerDependency (astro-mermaid client import) ([b3ad292](https://github.com/elcoosp/docs-toolkit/commit/b3ad292021805a734a6e491307c73a3dbe9a08f5))
* **postbuild:** remove broken fs.existsSync block that used un-imported fs ([495dc02](https://github.com/elcoosp/docs-toolkit/commit/495dc0287869f42f9ffed64fd918f754378c719f))
* re-enable git_only = true (path deps now fixed) ([c03c86c](https://github.com/elcoosp/docs-toolkit/commit/c03c86c6f142d277fad174d13dd49c578c1a77a9))
* **release-plz:** actually replace fetch step with gh api ([0ff606b](https://github.com/elcoosp/docs-toolkit/commit/0ff606beff4c2754e840d3c48c1fe63ac4b3db8e))
* **release-plz:** add --git-token and --forge github flags ([08ae62b](https://github.com/elcoosp/docs-toolkit/commit/08ae62b86d56479f1709c40d05d03d91e6da9014))
* **release-plz:** correct dry_run semantics ([a4925d3](https://github.com/elcoosp/docs-toolkit/commit/a4925d3f6f540064d3a757b978af939b9ffe5ef1))
* **release-plz:** definitively remove footer field ([2844447](https://github.com/elcoosp/docs-toolkit/commit/28444472a7e4d5e7b25c739b382f8d1d8bff784c))
* **release-plz:** disable semver_check for unpublished packages ([f25ad9b](https://github.com/elcoosp/docs-toolkit/commit/f25ad9b2614639dfa88602102f7d398f22299c84))
* **release-plz:** fetch config via gh api (cache-free) ([0df18d2](https://github.com/elcoosp/docs-toolkit/commit/0df18d25d006d6b23653d4998a6fed08667e3ef5))
* **release-plz:** git_only = true — use git tags as version baseline ([f565ddc](https://github.com/elcoosp/docs-toolkit/commit/f565ddcf5f64c28841348b33e21a76394753c0f0))
* **release-plz:** pass GH_TOKEN as required secret, force --forge/--git-token on release ([38b940e](https://github.com/elcoosp/docs-toolkit/commit/38b940e015a50a4b433aa6f1bd64765664ecbba7))
* **release-plz:** remove [[package]] from shared config ([a562192](https://github.com/elcoosp/docs-toolkit/commit/a56219234cc3833e5c6eef7f46dfd388fcdcfb7c))
* **release-plz:** rewrite workflow cleanly (no duplicate GH_TOKEN) ([02725ca](https://github.com/elcoosp/docs-toolkit/commit/02725ca1b16798916a48a6c8a4720cd5c73bcb70))
* **release-plz:** SHA-pinned config fetch to bypass CDN staleness ([a597fab](https://github.com/elcoosp/docs-toolkit/commit/a597fab496987039f3a982e14c60ab5d45e613d1))
* **release-plz:** skip unpublished internal crates ([b36bb74](https://github.com/elcoosp/docs-toolkit/commit/b36bb7474252f86bb616d015ee87ced43b249409))
* **template:** prefer RELEASE_PLZ_TOKEN over GITHUB_TOKEN ([853962a](https://github.com/elcoosp/docs-toolkit/commit/853962a2648741c740aed0558ff57f48746394dc))
* trigger initial release-please PR for OIDC verification ([23afee4](https://github.com/elcoosp/docs-toolkit/commit/23afee47139a6649d326d0121dd8b10a09d4fbf7))
* **types:** zero typecheck errors — Page.text field, fail() block body ([9e0e4cb](https://github.com/elcoosp/docs-toolkit/commit/9e0e4cb608a53d1dfdc6e111f2b499ea58fc7daf))
* **ui:** remove pluginCollapsible (Astro requires ec.config.mjs for functions) ([aed4c39](https://github.com/elcoosp/docs-toolkit/commit/aed4c39da3e461b4ce803e7f2845a5e36bb7ed21))
* **vite:** externalize starlight-llms-txt but transform via noExternal ([f4aaa18](https://github.com/elcoosp/docs-toolkit/commit/f4aaa181941a71cfb98ac186579d5fbfd393a8ef))
* 规范 release-plz.toml 配置 ([ab9b161](https://github.com/elcoosp/docs-toolkit/commit/ab9b161027a428c9ed70d7481b30812ae033f8d9))


### Performance Improvements

* add rust-cache@v2 and debug logs to release-plz ([0864328](https://github.com/elcoosp/docs-toolkit/commit/0864328500d0728d55d652ac13b9a3d55df2fce8))
* **release-plz:** add rust-cache, timeout, debug logs ([d48fed3](https://github.com/elcoosp/docs-toolkit/commit/d48fed35ab775705e6eb7dcc6095c3b1e5d99459))
* **release-plz:** lightweight dry-run preview (skip heavy update) ([0f400c2](https://github.com/elcoosp/docs-toolkit/commit/0f400c2b043664e69c5b688372ba480443ff257a))


### Reverts

* restore starlight-llms-txt bundling (required — plugin ships raw .ts) ([fb46a9f](https://github.com/elcoosp/docs-toolkit/commit/fb46a9f550f2b6d6f98819c5a2f7ec922f6550d6))


### Code Refactoring

* migrate docs-toolkit to TypeScript, build with tsdown ([1b1866f](https://github.com/elcoosp/docs-toolkit/commit/1b1866f8ecd7aa448d6cc17b903b532545ba771d))
