/**
 * Structured Logger
 *
 * Fastify'ın Pino logger'ını doğrudan kullanmak yerine,
 * tüm modüller (route dışı) için merkezi logger sağlar.
 * Her log mesajına otomatik olarak module, timestamp ve requestId eklenir.
 */

interface LogContext {
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

function getMinLevel(): number {
  const env = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (env && LOG_LEVELS[env] != null) return LOG_LEVELS[env];
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.warn : LOG_LEVELS.debug;
}

const minLevel = getMinLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

function formatMessage(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const entry = {
    level,
    time: new Date().toISOString(),
    module,
    msg: message,
    ...context,
  };
  return JSON.stringify(entry);
}

/**
 * Modül bazlı logger oluşturur.
 * Her servis/modül kendi logger'ını alır:
 *
 * ```ts
 * const log = createLogger('riskAnalyzer');
 * log.info('Analiz başladı', { clientId: 123 });
 * ```
 */
export function createLogger(module: string) {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) console.debug(formatMessage('debug', module, message, context));
    },
    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) console.info(formatMessage('info', module, message, context));
    },
    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) console.warn(formatMessage('warn', module, message, context));
    },
    error(message: string, context?: LogContext): void {
      if (shouldLog('error')) console.error(formatMessage('error', module, message, context));
    },
    fatal(message: string, context?: LogContext): void {
      if (shouldLog('fatal')) console.error(formatMessage('fatal', module, message, context));
    },
    /** Alt modül logger'ı oluştur (parent.child). */
    child(subModule: string) {
      return createLogger(`${module}.${subModule}`);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
