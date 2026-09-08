import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 단일 HTML 파일 빌드 (아티팩트/오프라인 배포용)
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist-single', assetsDir: 'assets' },
});
