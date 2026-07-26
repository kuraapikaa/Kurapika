import { describe, it, expect } from 'vitest';
import { createLogger } from '../lib/logger.js';

describe('logger', () => {
  it('should create a logger with all methods', () => {
    const log = createLogger('test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.fatal).toBe('function');
    expect(typeof log.child).toBe('function');
  });

  it('should create child loggers', () => {
    const log = createLogger('parent');
    const child = log.child('child');
    expect(typeof child.info).toBe('function');
  });

  it('should not throw when logging with context', () => {
    const log = createLogger('test');
    expect(() => log.info('test message', { key: 'value', num: 42 })).not.toThrow();
    expect(() => log.error('error message', { err: new Error('test') })).not.toThrow();
  });
});
