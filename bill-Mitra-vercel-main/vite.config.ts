import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'zite-auth-sdk': path.resolve(__dirname, './src/mocks/zite-auth-sdk.ts'),
      'zite-endpoints-sdk': path.resolve(__dirname, './src/mocks/zite-endpoints-sdk.ts'),
      'zite-file-upload-sdk': path.resolve(__dirname, './src/mocks/zite-file-upload-sdk.ts'),
      'zite-integrations-backend-sdk': path.resolve(__dirname, './src/mocks/zite-integrations-backend-sdk.ts')
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
});
