// Pure scheduling logic for the auto-updater, kept free of any Electron
// imports so it can be unit-tested in isolation.

// Shared by both the periodic recheck interval and the on-focus staleness
// check — there is exactly one cadence constant for the whole updater.
export const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Decide whether a window-focus event should trigger an update check.
// Returns true when we've never checked, or when the last check is at least
// one interval old. This catches machines waking from sleep, where the
// setInterval timer may not have fired.
export function shouldCheckOnFocus(lastCheckAt: number | null, now: number): boolean {
  if (lastCheckAt === null) return true;
  return now - lastCheckAt >= RECHECK_INTERVAL_MS;
}
