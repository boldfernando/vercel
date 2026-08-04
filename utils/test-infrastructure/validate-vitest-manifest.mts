import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runDiscovery } from './discover-vitest-projects.js';

export function validateHealthAndManifest() {
  const { projects, rootDir } = runDiscovery();
  const errors: string[] = [];

  // Check 1: Ensure no fixture, eval or example configs are missing exclusion flag
  for (const proj of projects) {
    if ((proj.type === 'fixture' || proj.type === 'eval' || proj.type === 'example') && !proj.isExcludedFromRoot) {
      errors.push(`[E2E-012] Project ${proj.relativePath} of type '${proj.type}' is NOT properly excluded from root runner!`);
    }
  }

  // Check 2: Verify root settings exclude pattern matches discovered fixtures
  const rootConfigPath = join(rootDir, 'vitest.config.mts');
  if (existsSync(rootConfigPath)) {
    const rootConfigContent = readFileSync(rootConfigPath, 'utf-8');
    if (!rootConfigContent.includes('**/test/fixtures/**') || !rootConfigContent.includes('**/packages/cli/evals/**')) {
      errors.push(`[E2E-009] Root vitest.config.mts missing required exclusion patterns for fixtures and evals!`);
    }
  }

  if (errors.length > 0) {
    console.error(`❌ [E2E-012/E2E-015] Manifest Validation Failed with ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ [E2E-012/E2E-015] Health check and manifest validation passed successfully! (${projects.length} vitest configs verified)`);
}

validateHealthAndManifest();
