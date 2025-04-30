import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  minify: true,
  shims: true,
  dts: false,
  sourcemap: true,
  outDir: 'dist',
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  esbuildOptions(options) {
    options.platform = 'node';
    options.format = 'esm';
  },
});
