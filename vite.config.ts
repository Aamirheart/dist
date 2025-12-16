import { defineConfig } from 'vite';
import typescript from '@rollup/plugin-typescript';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    typescript({
      target: 'es2020',
      rootDir: resolve(__dirname, './'),
      tsconfig: resolve(__dirname, 'tsconfig.json'),
      include: [resolve(__dirname, './demo.ts')],
    }),
  ],
  server: {
    // Allows access from network/other devices (e.g., for mobile testing)
    host: '0.0.0.0',
  },
});