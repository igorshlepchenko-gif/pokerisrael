import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The Hand Logger components/context are imported from ../client/src as source
    // (not a published package), so without this, Vite/Node module resolution walking
    // up from those files' own physical location would find client/node_modules/react
    // instead of this project's copy — two React instances in one app breaks Context
    // and react-router-dom's useNavigate/Link.
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    host: true,
    // Vite only auto-widens fs.allow to a workspace root when it detects workspaces/
    // pnpm-workspace.yaml/lerna.json. This repo has none, so without this the dev
    // server 403s any request for a file under ../client/src.
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
