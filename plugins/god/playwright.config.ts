import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = 'tests/bdd/bdd-gen';

const bdd = defineBddConfig({
  featuresRoot: 'tests/bdd',
  features: 'tests/bdd/features/**/*.feature',
  steps: ['tests/bdd/steps/**/*.js', 'tests/bdd/fixtures.js'],
  outputDir: testDir,
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  reporter: 'json',
  use: { baseURL: 'http://localhost:0' },
  projects: [{ name: 'bdd', testMatch: /.*\.feature\.spec\.js$/ }],
});
