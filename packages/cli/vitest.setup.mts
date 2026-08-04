import { beforeAll, afterAll, vi } from 'vitest';
import output from './src/output-manager';

// Registry of spawned process PIDs for E2E-019 / E2E-020 child process teardown
const activeSubprocesses = new Set<number>();

beforeAll(() => {
  output.initialize({
    supportsHyperlink: false,
    noColor: true,
  });
});

afterAll(async () => {
  // Restore all mocks and timers
  vi.restoreAllMocks();

  // Terminate any active child processes registered during test run
  for (const pid of activeSubprocesses) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already terminated
    }
  }
  activeSubprocesses.clear();
});

if (process.debugPort) {
  // when debugging in an IDE, set a high timeout
  vi.setConfig({ testTimeout: 10 * 60 * 1000 });
}


