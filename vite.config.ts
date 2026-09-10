import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

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
  plugins: [inspectAttr(), react(), injectCsp()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
