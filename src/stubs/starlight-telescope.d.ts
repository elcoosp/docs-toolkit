// Shadow for starlight-telescope — its raw .ts does not compile against starlight 0.42.
// Overrides via tsconfig "paths". Runtime resolution unaffected (tsdown ignores paths).
declare const plugin: (opts?: Record<string, unknown>) => unknown;
export default plugin;
