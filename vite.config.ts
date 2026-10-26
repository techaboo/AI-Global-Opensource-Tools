import path from "path"
import { readFileSync } from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Fill the __TOOL_COUNT__ / __CATEGORY_COUNT__ placeholders in index.html meta tags.
function injectCatalogCounts(): Plugin {
  return {
    name: 'inject-catalog-counts',
    transformIndexHtml(html) {
      const catalog = JSON.parse(readFileSync(path.resolve(__dirname, 'src/data/catalog.json'), 'utf8'));
      return html
        .replaceAll('__TOOL_COUNT__', String(catalog.tools.length))
        .replaceAll('__CATEGORY_COUNT__', String(catalog.categories.length));
    },
  };
}

// Dev mode needs an inline script for React Fast Refresh (injected by @vitejs/plugin-react)
// that a strict script-src would block, so this CSP <meta> is only added to the production build.
function injectCsp(): Plugin {
  const csp = "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://api.github.com; font-src 'self' data:; base-uri 'self'; form-action 'self'; object-src 'none'";
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      // Keep <meta charset> first per the HTML spec (must be within the first 1024 bytes);
      // CSP goes immediately after it, still ahead of every other head element.
      return html.replace(/(<meta charset="[^"]*"\s*\/?>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), injectCsp(), injectCatalogCounts()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/catalog.json') || id.includes('/src/data/tools.ts')) return 'catalog-data';
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('sonner')) return 'ui-vendor';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
