import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['vscode-languageserver', 'vscode-languageserver-textdocument'],
  },
  {
    entry: { 'lsp-server': 'src/lsp-server.ts' },
    format: ['cjs'],
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    platform: 'node',
  },
]);
