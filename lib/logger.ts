const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type LogLevel = keyof typeof levels;
type LogContext = Record<string, unknown>;
const sensitive = /password|token|secret|authorization|cookie/i;

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : redactLogValue(item)]));
  return value;
}
export function serializeLog(level: LogLevel, message: string, context: LogContext = {}) { return JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redactLogValue(context) as LogContext }); }
function enabled(level: LogLevel) { const configured = (process.env.LOG_LEVEL || "info") as LogLevel; return levels[level] >= (levels[configured] ?? levels.info); }
export const logger = {
  debug(message: string, context?: LogContext) { if (enabled("debug")) console.debug(serializeLog("debug", message, context)); },
  info(message: string, context?: LogContext) { if (enabled("info")) console.info(serializeLog("info", message, context)); },
  warn(message: string, context?: LogContext) { if (enabled("warn")) console.warn(serializeLog("warn", message, context)); },
  error(message: string, context?: LogContext) { if (enabled("error")) console.error(serializeLog("error", message, context)); },
};
