import { beforeAll, afterAll, vi } from 'vitest';
import output from './src/output-manager';

beforeAll(() => {
  output.initialize({
    supportsHyperlink: false,
    noColor: true,
  });
});

afterAll(() => {
  // Ensure any pending timers or process listeners are cleared
  vi.restoreAllMocks();
});

if (process.debugPort) {
  // when debugging in an IDE, set a high timeout
  vi.setConfig({ testTimeout: 10 * 60 * 1000 });
}

