import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Executes a function within an isolated process.env sandbox (E2E-025)
 */
export async function withIsolatedEnv<T>(
  customEnv: Record<string, string>,
  fn: () => Promise<T> | T
): Promise<T> {
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, customEnv);
    return await fn();
  } finally {
    // Restore process.env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }
}

/**
 * Creates a hermetic temporary workspace directory for test execution and ensures complete teardown (E2E-026)
 */
export async function withTempWorkspace<T>(
  prefix: string,
  fn: (workspaceDir: string) => Promise<T> | T
): Promise<T> {
  const tempPath = mkdtempSync(join(tmpdir(), `vercel-test-${prefix}-`));
  try {
    return await fn(tempPath);
  } finally {
    if (existsSync(tempPath)) {
      try {
        rmSync(tempPath, { recursive: true, force: true });
      } catch {
        // Windows file lock fallback
      }
    }
  }
}
