import { createServer, type Server } from 'net';

export interface LeasedPort {
  port: number;
  release: () => Promise<void>;
}

const leasedPorts = new Map<number, Server>();

/**
 * Dynamically leases a free TCP port on localhost and holds a reservation lock (E2E-021)
 */
export async function leaseAvailablePort(
  minPort = 20000,
  maxPort = 60000
): Promise<LeasedPort> {
  let attempt = 0;
  const maxAttempts = 100;

  while (attempt < maxAttempts) {
    attempt++;
    const candidatePort =
      Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;

    if (leasedPorts.has(candidatePort)) {
      continue;
    }

    try {
      const server = createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(candidatePort, '127.0.0.1', () => resolve());
      });

      leasedPorts.set(candidatePort, server);

      const release = async () => {
        if (leasedPorts.has(candidatePort)) {
          const s = leasedPorts.get(candidatePort);
          leasedPorts.delete(candidatePort);
          if (s) {
            await new Promise<void>(resolve => s.close(() => resolve()));
          }
        }
      };

      return {
        port: candidatePort,
        release,
      };
    } catch {
      // Port in use, retry next candidate
    }
  }

  throw new Error(
    `[E2E-021] Failed to lease an available port after ${maxAttempts} attempts.`
  );
}

export async function releaseAllLeasedPorts(): Promise<void> {
  const ports = Array.from(leasedPorts.keys());
  for (const port of ports) {
    const s = leasedPorts.get(port);
    leasedPorts.delete(port);
    if (s) {
      await new Promise<void>(resolve => s.close(() => resolve()));
    }
  }
}
