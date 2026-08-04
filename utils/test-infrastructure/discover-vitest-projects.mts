import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

export interface VitestProjectConfig {
  name: string;
  relativePath: string;
  type: 'workspace-root' | 'package' | 'eval' | 'example' | 'fixture';
  isExcludedFromRoot: boolean;
}

function findVitestConfigs(dir: string, results: VitestProjectConfig[] = []): VitestProjectConfig[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      findVitestConfigs(join(dir, entry.name), results);
    } else if (entry.name.startsWith('vitest.config.')) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');

      let type: VitestProjectConfig['type'] = 'package';
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

      const isExcludedFromRoot = type === 'eval' || type === 'example' || type === 'fixture';

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

  console.log(`[E2E-012] Discovered ${projects.length} vitest project configs across monorepo. Saved manifest to ${manifestPath}`);
  return { projects, rootDir };
}
