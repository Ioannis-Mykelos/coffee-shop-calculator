// Server logs as one JSON object per line: the level, what happened (`event`), when, and the details. Errors are written
// out with their name, message and stack, never as "[object Object]". Netlify's function logs show them as they are.
// Server code only (it's also loaded by tests, so it doesn't import server-only).

export type LogLevel = 'info' | 'warn' | 'error';

/** Details as they should appear in a log line: errors spelled out, everything else as it is */
function serializable(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v]),
  );
}

/** The log line for an event, as written (exported for the tests). */
export const logLine = (level: LogLevel, event: string, fields: Record<string, unknown>) =>
  JSON.stringify({ level, event, time: new Date().toISOString(), ...serializable(fields) });

/** Logs `event` with its details. Never throws. */
export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  try {
    write(logLine(level, event, fields));
  } catch {
    write(`${level} ${event}`);
  }
}
