import { beforeAll, afterEach, afterAll, vi, expect } from 'vitest';
import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import output from './src/output-manager';

const execFileAsync = promisify(execFile);

export type TrackedProcess = {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  owner: string;
  startedAt: number;
  process: ChildProcess;
};

// Central process registry for E2E-019
export const activeSubprocesses = new Map<number, TrackedProcess>();

/**
 * Spawns a child process and registers it for complete lifecycle tracking and tree termination (E2E-019)
 */
export function spawnTracked(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): ChildProcess {
  const isWindows = process.platform === 'win32';
  const child = spawn(command, args, {
    ...options,
    detached: !isWindows ? true : options.detached,
  });

  if (!child.pid) {
    throw new Error(`Failed to obtain PID for command: ${command}`);
  }

  let testName = 'unknown';
  try {
    testName = expect.getState().currentTestName ?? 'global';
  } catch {
    testName = 'global';
  }

  const tracked: TrackedProcess = {
    pid: child.pid,
    command,
    args,
    cwd: String(options.cwd ?? process.cwd()),
    owner: testName,
    startedAt: Date.now(),
    process: child,
  };

  activeSubprocesses.set(child.pid, tracked);

  child.once('exit', () => {
    if (child.pid) {
      activeSubprocesses.delete(child.pid);
    }
  });

  return child;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlreadyGoneError(err: any): boolean {
  if (!err) return true;
  const msg = String(err.message || err.stderr || err.stdout || '');
  return msg.includes('not found') || msg.includes('nao encontrado') || msg.includes('ESRCH') || msg.includes('exit code 128');
}

/**
 * Cross-platform process tree termination (E2E-020)
 * On Windows: uses `taskkill /PID <pid> /T /F`
 * On Unix: sends SIGTERM/SIGKILL to process group
 */
export async function terminateProcessTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    } catch (err) {
      if (!isProcessAlreadyGoneError(err)) {
        throw err;
      }
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }

    await new Promise(r => setTimeout(r, 150));

    if (isProcessAlive(pid)) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
    }
  }

  // Ensure process is dead before deleting from tracking registry
  if (isProcessAlive(pid)) {
    throw new Error(`[E2E-020] Process ${pid} survived teardown procedure!`);
  }

  activeSubprocesses.delete(pid);
}

/**
 * Teardown procedure for all registered subprocesses
 */
export async function cleanupAllTrackedProcesses(): Promise<void> {
  const pids = Array.from(activeSubprocesses.keys());
  for (const pid of pids) {
    await terminateProcessTree(pid);
  }
  activeSubprocesses.clear();
}

beforeAll(() => {
  output.initialize({
    supportsHyperlink: false,
    noColor: true,
  });
});

afterEach(async () => {
  // Clean up any processes registered during the individual test
  await cleanupAllTrackedProcesses();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await cleanupAllTrackedProcesses();
});

// Process signal listeners for emergency teardown
process.once('SIGINT', () => { void cleanupAllTrackedProcesses(); });
process.once('SIGTERM', () => { void cleanupAllTrackedProcesses(); });
process.once('beforeExit', () => { void cleanupAllTrackedProcesses(); });

if (process.debugPort) {
  vi.setConfig({ testTimeout: 10 * 60 * 1000 });
}



