const isProduction = process.env.NODE_ENV === "production";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const currentLevel: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || (isProduction ? "error" : "info");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(currentLevel);
}

function prefix(level: LogLevel): string {
  return `[Admin v2] [${level.toUpperCase()}]`;
}

function serialize(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return { message: arg.message, name: arg.name, stack: isProduction ? undefined : arg.stack };
    }
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
}

export const logger = {
  debug(...args: unknown[]) {
    if (shouldLog("debug")) {
      console.debug(prefix("debug"), ...serialize(args));
    }
  },
  info(...args: unknown[]) {
    if (shouldLog("info")) {
      console.info(prefix("info"), ...serialize(args));
    }
  },
  warn(...args: unknown[]) {
    if (shouldLog("warn")) {
      console.warn(prefix("warn"), ...serialize(args));
    }
  },
  error(...args: unknown[]) {
    if (shouldLog("error")) {
      console.error(prefix("error"), ...serialize(args));
    }
  },
};
