import { readFileSync, existsSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const PLUGIN_TS_RE =
  /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:starlight-[^/]+|astro-d2)\/.*\.ts$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      const resolved = nextResolve(specifier, context);
      if (resolved.url.startsWith('file://') && PLUGIN_TS_RE.test(resolved.url)) {
        return { ...resolved, format: 'module', shortCircuit: true };
      }
      return resolved;
    } catch (err: any) {
      if (
        (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') &&
        context.parentURL &&
        PLUGIN_TS_RE.test(context.parentURL) &&
        (specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../'))
      ) {
        const base = (specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier).replace(/\/+$/, '');
        for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
          const tsUrl = new URL(candidate, context.parentURL);
          if (existsSync(fileURLToPath(tsUrl))) {
            return { url: tsUrl.href, format: 'module', shortCircuit: true };
          }
        }
      }
      throw err;
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file://') && PLUGIN_TS_RE.test(url)) {
      const raw = readFileSync(fileURLToPath(url), 'utf8');
      const source = stripTypeScriptTypes(raw, { mode: 'strip' });
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
