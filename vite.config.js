import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  plugins: [viteSingleFile()],
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
