export interface HandleSnapshot {
  timestamp: number;
  handlesCount: number;
  types: string[];
}

export function captureHandleSnapshot(): HandleSnapshot {
  const processAny = process as any;
  const handles: any[] =
    typeof processAny._getActiveHandles === 'function'
      ? processAny._getActiveHandles()
      : [];

  const types = handles.map(h => {
    if (!h) return 'unknown';
    if (h.constructor && h.constructor.name) return h.constructor.name;
    return typeof h;
  });

  return {
    timestamp: Date.now(),
    handlesCount: handles.length,
    types,
  };
}

export function assertNoNewLingeringHandles(
  beforeSnapshot: HandleSnapshot
): void {
  const afterSnapshot = captureHandleSnapshot();
  const beforeCount = beforeSnapshot.handlesCount;
  const afterCount = afterSnapshot.handlesCount;

  if (afterCount > beforeCount) {
    const newTypes = afterSnapshot.types.slice(beforeCount);
    const leakedSockets = newTypes.filter(
      t =>
        t === 'Server' || t === 'Socket' || t === 'TCPServerWrap' || t === 'TCP'
    );

    if (leakedSockets.length > 0) {
      throw new Error(
        `[E2E-022] Detected ${leakedSockets.length} new unclosed socket/server handle(s) lingering after test execution: ${leakedSockets.join(', ')}`
      );
    }
  }
}
