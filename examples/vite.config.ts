import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname)
const src = resolve(root, '../src')

// The examples import the engine from source, exactly as a project would
// import the package: `@veyra/core` and `@veyra/core/three`.
export default defineConfig({
  root,
  base: './',
  resolve: {
    alias: [
      { find: /^@veyra\/core\/three$/, replacement: resolve(src, 'three/index.ts') },
      { find: /^@veyra\/core$/, replacement: resolve(src, 'index.ts') },
    ],
  },
  build: {
    outDir: resolve(root, '../examples-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        persianType: resolve(root, 'persian-type/index.html'),
        scrollScenes: resolve(root, 'scroll-scenes/index.html'),
        threeDom: resolve(root, 'three-dom/index.html'),
      },
    },
  },
})
