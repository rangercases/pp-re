import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      // Vite hashes <link rel="manifest"> as a build asset, which breaks the
      // stable /manifest.json path required by the service worker and iOS.
      name: 'stable-pwa-manifest-link',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/i,
          '<link rel="manifest" href="./manifest.json">');
      }
    },
    cloudflare()
  ],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    minify: false, // Giữ nguyên tên hàm để tương thích hoàn hảo 100% với các thẻ onclick="handleFile()" trong HTML
    rollupOptions: {
      treeshake: false, // Tắt treeshake để đảm bảo không một hàm xử lý nào bị bỏ sót
    }
  },
});