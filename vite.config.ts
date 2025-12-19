
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', 
  define: {
    // 確保這些變數在全域可用
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ""),
    'process.env.FIREBASE_CONFIG': JSON.stringify(process.env.FIREBASE_CONFIG || "")
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
