import { describe, it, expect } from 'vitest';
import { validateEnvironment } from '../lib/envValidator.js';

describe('envValidator', () => {
  it('should return warnings when SESSION_SECRET is not set', () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    const result = validateEnvironment();
    expect(result.warnings.some(w => w.includes('SESSION_SECRET'))).toBe(true);

    // Restore
    if (original) process.env.SESSION_SECRET = original;
  });

  it('should return no errors when AUTH_TOKEN is set', () => {
    const original = process.env.AUTH_TOKEN;
    process.env.AUTH_TOKEN = 'test-token-for-validation';

    const result = validateEnvironment();
    expect(result.errors.some(e => e.includes('AUTH_TOKEN'))).toBe(false);

    // Restore
    if (original) process.env.AUTH_TOKEN = original;
    else delete process.env.AUTH_TOKEN;
  });

  it('should validate PORT format', () => {
    const original = process.env.PORT;
    process.env.PORT = 'not-a-port';

    const result = validateEnvironment();
    expect(result.warnings.some(w => w.includes('PORT'))).toBe(true);

    // Restore
    if (original) process.env.PORT = original;
    else delete process.env.PORT;
  });
});
