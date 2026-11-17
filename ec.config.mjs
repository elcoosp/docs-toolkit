import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';

export default {
  plugins: [pluginLineNumbers()],
  shiki: {
    langs: [...(globalThis.__docsToolkitShikiLangs ?? [])],
  },
};
