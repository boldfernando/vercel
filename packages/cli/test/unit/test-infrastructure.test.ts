import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import {
  leaseAvailablePort,
  releaseAllLeasedPorts,
} from '../../../../utils/test-infrastructure/port-leasing';
import {
  captureHandleSnapshot,
  assertNoNewLingeringHandles,
} from '../../../../utils/test-infrastructure/handle-detector';
import {
  withIsolatedEnv,
  withTempWorkspace,
} from '../../../../utils/test-infrastructure/test-sandbox';

describe('Test Infrastructure Suite (E2E-021, E2E-022, E2E-025, E2E-026)', () => {
  it('leases an available TCP port and releases it cleanly (E2E-021)', async () => {
    const lease = await leaseAvailablePort();
    expect(lease.port).toBeGreaterThan(1000);

    await lease.release();
    await releaseAllLeasedPorts();
  });

  it('inspects event loop handles and detects unclosed sockets via snapshots (E2E-022)', () => {
    const before = captureHandleSnapshot();
    expect(before.handlesCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(before.types)).toBe(true);

    expect(() => assertNoNewLingeringHandles(before)).not.toThrow();
  });

  it('isolates process.env modifications within sandbox (E2E-025)', async () => {
    const KEY = 'VERCEL_TEST_ENV_VAR_12345';
    delete process.env[KEY];

    await withIsolatedEnv({ [KEY]: 'SANDBOXED_VALUE' }, () => {
      expect(process.env[KEY]).toBe('SANDBOXED_VALUE');
    });

    expect(process.env[KEY]).toBeUndefined();
  });

  it('creates and destroys a temporary workspace directory (E2E-026)', async () => {
    let createdPath = '';

    await withTempWorkspace('unit-test', tempDir => {
      createdPath = tempDir;
      expect(existsSync(tempDir)).toBe(true);
    });

    expect(createdPath.length).toBeGreaterThan(0);
    expect(existsSync(createdPath)).toBe(false);
  });
});
