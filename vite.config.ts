/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages のリポジトリ名。リポジトリ名を変えたらここ1行を直す
  base: '/MULTIPLY/',
  plugins: [react()],
  test: {
    // src/core は DOM 非依存なので node 環境で足りる
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
