import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O sistema é aberto direto do disco/rede (file://), sem servidor.
// Por isso tudo (JS, CSS, bibliotecas) é embutido em um único index.html,
// gerado em ../sistema/.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: '../sistema',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
