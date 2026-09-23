import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  
  define: {
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || ''),
  },

  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/metrics': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              name: 'vendor-router',
              test: /node_modules[\\/](react-router|react-router-dom)[\\/]/,
              priority: 45,
            },
            {
              name: 'vendor-charts',
              test: /node_modules[\\/](recharts|victory-vendor|@reduxjs|react-redux|reselect|immer|d3-.*)[\\/]/,
              priority: 40,
            },
            {
              name: 'vendor-pdf-gen',
              test: /node_modules[\\/](jspdf|html2canvas|canvg)[\\/]/,
              priority: 35,
            },
            {
              name: 'vendor-pdf-parse',
              test: /node_modules[\\/]pdfjs-dist[\\/]/,
              priority: 35,
            },
            {
              name: 'vendor-framer',
              test: /node_modules[\\/]framer-motion[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-dnd',
              test: /node_modules[\\/]@dnd-kit[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-date',
              test: /node_modules[\\/]date-fns[\\/]/,
              priority: 25,
            },
            {
              name: 'vendor-csv',
              test: /node_modules[\\/]papaparse[\\/]/,
              priority: 25,
            },
          ],
        },
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-router';
          if (/[\\/]node_modules[\\/](recharts|victory-vendor|@reduxjs|react-redux|reselect|immer|d3-.*)[\\/]/.test(id)) return 'vendor-charts';
          if (/[\\/]node_modules[\\/](jspdf|html2canvas|canvg)[\\/]/.test(id)) return 'vendor-pdf-gen';
          if (/[\\/]node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'vendor-pdf-parse';
          if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) return 'vendor-framer';
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          if (/[\\/]node_modules[\\/]@dnd-kit[\\/]/.test(id)) return 'vendor-dnd';
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'vendor-date';
          if (/[\\/]node_modules[\\/]papaparse[\\/]/.test(id)) return 'vendor-csv';
        },
      },
    },
  }
})
