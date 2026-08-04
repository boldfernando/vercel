import { describe, it, expect } from 'vitest';
import { once } from 'node:events';
import {
  spawnTracked,
  terminateProcessTree,
  activeSubprocesses,
  isProcessAlive,
} from '../../vitest.setup.mts';

describe('Process Tracking & Tree Teardown Infrastructure (E2E-019, E2E-020)', () => {
  it('registers a spawned process in activeSubprocesses registry (E2E-019)', async () => {
    const child = spawnTracked(process.execPath, [
      '-e',
      'setTimeout(() => {}, 30000)',
    ]);

    expect(child.pid).toBeDefined();
    const pid = child.pid!;

    expect(activeSubprocesses.has(pid)).toBe(true);

    const tracked = activeSubprocesses.get(pid)!;
    expect(tracked.pid).toBe(pid);
    expect(tracked.command).toBe(process.execPath);
    expect(tracked.owner).toBeDefined();

    await terminateProcessTree(pid);

    expect(activeSubprocesses.has(pid)).toBe(false);
    expect(isProcessAlive(pid)).toBe(false);
  });

  it('removes naturally exited processes from the activeSubprocesses registry (E2E-019)', async () => {
    const child = spawnTracked(process.execPath, ['-e', 'process.exit(0)']);
    const pid = child.pid!;

    await once(child, 'exit');

    expect(activeSubprocesses.has(pid)).toBe(false);
  });

  it('terminates parent and descendant processes tree completely (E2E-020)', async () => {
    // Spawns a parent node process that in turn spawns a child process
    const parent = spawnTracked(process.execPath, [
      '-e',
      `
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
        console.log('CHILD_PID:' + child.pid);
        setTimeout(() => {}, 30000);
      `,
    ]);

    expect(parent.pid).toBeDefined();
    const parentPid = parent.pid!;

    let childPid = 0;
    await new Promise<void>(resolve => {
      parent.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        if (str.includes('CHILD_PID:')) {
          childPid = parseInt(str.split('CHILD_PID:')[1].trim(), 10);
          resolve();
        }
      });
    });

    expect(childPid).toBeGreaterThan(0);
    expect(isProcessAlive(parentPid)).toBe(true);
    expect(isProcessAlive(childPid)).toBe(true);

    // Act: terminate the entire process tree starting from parent
    await terminateProcessTree(parentPid);

    // Assert: Both parent and child process must be dead
    expect(isProcessAlive(parentPid)).toBe(false);
    expect(isProcessAlive(childPid)).toBe(false);
  });
});
