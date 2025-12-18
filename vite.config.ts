
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // 關鍵：確保 GitHub Pages 子目錄路徑正確，避免白屏
  define: {
    // 注入環境變數，讓程式碼中可以透過 process.env 存取
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.FIREBASE_CONFIG': JSON.stringify(process.env.FIREBASE_CONFIG)
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 開發初期保留 console 以便除錯
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
