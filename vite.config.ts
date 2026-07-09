import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/photoCropper-tool/',
  plugins: [react()],
  optimizeDeps: {
    include: ['@mediapipe/face_detection'],
  },
});
