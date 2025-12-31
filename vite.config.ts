import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 使用相對路徑，讓部署在 GitHub Pages 子目錄時也能正常運作
  base: './', 
  define: {
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