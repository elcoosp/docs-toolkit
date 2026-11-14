// Shadow for starlight-view-modes — its raw .ts does not compile against starlight 0.42.
// Overrides via tsconfig "paths". Runtime resolution unaffected (tsdown ignores paths).
declare const plugin: (opts?: {
  zenModeSettings?: {
    enabled?: boolean;
    displayOptions?: Record<string, unknown>;
    exclude?: string[];
    keyboardShortcut?: string;
  };
  presentationModeSettings?: {
    enabled?: boolean;
    exclude?: string[];
    keyboardShortcut?: string;
  };
}) => unknown;
export default plugin;
