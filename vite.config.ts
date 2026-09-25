import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Content-Security-Policy for hosts where you can't set response headers (e.g. Lovable).
 * Injected as a <meta> tag in production builds only: Vite's dev server relies on inline
 * scripts for hot reload, which this policy blocks. On the Docker/nginx deployment the
 * same policy (plus frame-ancestors, which meta tags can't express) is sent as a header.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React style attributes and the 3D library's inline styles
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [react(), cspMeta()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { chunkSizeWarningLimit: 2000 },
});
