import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsxFactory: 'jsx',
    jsxFragment: 'Fragment',
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'rxjs-bindings',
    },
    rollupOptions: {
      external: [/^rxjs(\/|$)/],
    },
  },
});
