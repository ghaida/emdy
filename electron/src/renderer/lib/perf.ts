const ENABLE_PERF = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('perf');

export function perfMark(label: string) {
  if (!ENABLE_PERF) return;
  performance.mark(label);
}

export function perfMeasure(label: string, startMark: string) {
  if (!ENABLE_PERF) return;
  performance.mark(label + '-end');
  const measure = performance.measure(label, startMark, label + '-end');
  console.log(`[perf] ${label}: ${measure.duration.toFixed(1)}ms`);
}
