/**
 * Structured JSON logger shared across the Node services.
 *
 * Every log line is a single JSON object with the fields the design's Observability section
 * mandates: `timestamp, level, service, correlationId, message, context`. The correlation id
 * ties log lines to a single request as it flows across services (Req 20.2).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** A single structured log record. */
export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  correlationId?: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface LoggerOptions {
  /** Logical service name, e.g. `auth`, `bff`, `payment`. */
  service: string;
  /** Minimum level to emit. Defaults to `info` (or `LOG_LEVEL` env var when present). */
  level?: LogLevel;
  /** Correlation id bound to this logger instance (set per request via {@link Logger.child}). */
  correlationId?: string;
  /** Sink for serialized lines. Defaults to `process.stdout.write`. */
  sink?: (line: string) => void;
}

/**
 * Minimal dependency-free structured logger. Use {@link Logger.child} to derive a per-request
 * logger carrying the request's correlation id.
 */
export class Logger {
  private readonly service: string;
  private readonly level: LogLevel;
  private readonly correlationId?: string;
  private readonly sink: (line: string) => void;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info';
    this.correlationId = options.correlationId;
    this.sink = options.sink ?? ((line: string) => process.stdout.write(line + '\n'));
  }

  /** Derive a new logger that inherits config but carries the given correlation id/context. */
  child(correlationId: string): Logger {
    return new Logger({
      service: this.service,
      level: this.level,
      correlationId,
      sink: this.sink,
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) {
      return;
    }
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
    };
    if (this.correlationId !== undefined) {
      record.correlationId = this.correlationId;
    }
    if (context !== undefined) {
      record.context = context;
    }
    this.sink(JSON.stringify(record));
  }
}

/** Convenience factory for a base (request-agnostic) logger. */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
