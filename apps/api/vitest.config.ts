import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.mongo.test.ts'],
        },
      },
      {
        test: {
          name: 'mongo',
          include: ['test/**/*.mongo.test.ts'],
          globalSetup: ['test/mongo-setup.ts'],
          // The first run pulls the image.
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
