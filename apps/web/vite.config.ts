import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "firebase/firestore": path.resolve(__dirname, "./src/lib/sira-firestore-adapter.ts"),
      "firebase/auth": path.resolve(__dirname, "./src/lib/sira-auth-adapter.ts"),
      "firebase/functions": path.resolve(__dirname, "./src/lib/sira-functions-adapter.ts"),
    },
  },
  envDir: './',
  envPrefix: 'VITE_',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-charts': ['recharts'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    // Aumentar limite de aviso para 1MB (era 500KB)
    chunkSizeWarningLimit: 1000
  }
}));
