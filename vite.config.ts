/// <reference types="vitest/config" />

// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from 'vite'

export default defineConfig({
    test: {
      coverage: {
        exclude: ['vite.config.ts' ,'bin/run.cjs', 'src/**/index**']
      }
        /* for example, use global to avoid globals imports (describe, test, expect): */
        // globals: true,
    },
})