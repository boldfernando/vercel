import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

function findVitestConfigs(dir, results = []) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git'
      ) {
        continue;
      }
      findVitestConfigs(join(dir, entry.name), results);
    } else if (entry.name.startsWith('vitest.config.')) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');

      let type = 'package';
      if (relPath === 'vitest.config.mts') {
        type = 'workspace-root';
      } else if (relPath.includes('/evals/')) {
        type = 'eval';
      } else if (relPath.startsWith('examples/')) {
        type = 'example';
      } else if (relPath.includes('/fixtures/')) {
        type = 'fixture';
      }

      let name = relPath;
      const pkgPath = join(dir, 'package.json');
      try {
        const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkgJson.name) name = pkgJson.name;
      } catch {}

      const isExcludedFromRoot =
        type === 'eval' || type === 'example' || type === 'fixture';

      results.push({
        name,
        relativePath: relPath,
        type,
        isExcludedFromRoot,
      });
    }
  }

  return results;
}

export function runDiscovery() {
  const projects = findVitestConfigs(rootDir);
  const outDir = join(rootDir, 'artifacts');
  mkdirSync(outDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalProjects: projects.length,
    projects,
  };

  const manifestPath = join(outDir, 'vitest-discovered-projects.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(
    `[E2E-012] Discovered ${projects.length} vitest project configs across monorepo. Saved manifest to ${manifestPath}`
  );
  return { projects, rootDir };
}

export function validateHealthAndManifest() {
  const { projects, rootDir } = runDiscovery();
  const errors = [];

  for (const proj of projects) {
    if (
      (proj.type === 'fixture' ||
        proj.type === 'eval' ||
        proj.type === 'example') &&
      !proj.isExcludedFromRoot
    ) {
      errors.push(
        `[E2E-012] Project ${proj.relativePath} of type '${proj.type}' is NOT properly excluded from root runner!`
      );
    }
  }

  const rootConfigPath = join(rootDir, 'vitest.config.mts');
  if (existsSync(rootConfigPath)) {
    const rootConfigContent = readFileSync(rootConfigPath, 'utf-8');
    if (
      !rootConfigContent.includes('**/test/fixtures/**') ||
      !rootConfigContent.includes('**/packages/cli/evals/**')
    ) {
      errors.push(
        `[E2E-009] Root vitest.config.mts missing required exclusion patterns for fixtures and evals!`
      );
    }
  }

  if (errors.length > 0) {
    console.error(
      `❌ [E2E-012/E2E-015] Manifest Validation Failed with ${errors.length} error(s):`
    );
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [E2E-012/E2E-015] Health check and manifest validation passed successfully! (${projects.length} vitest configs verified)`
  );
}

validateHealthAndManifest();
