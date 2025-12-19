
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', 
  define: {
    // 使用 String() 包裹確保傳入的是字串，避免產生 undefined symbol
    'process.env.API_KEY': JSON.stringify(String(process.env.API_KEY || "")),
    'process.env.FIREBASE_CONFIG': JSON.stringify(String(process.env.FIREBASE_CONFIG || ""))
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts']
        }
      }
    }
  }
});
