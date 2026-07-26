import { describe, it, expect } from 'vitest';
import { httpRequest, getCircuitBreakerStatus } from '../lib/httpClient.js';

describe('httpClient', () => {
  describe('httpRequest', () => {
    it('should return ok:false for unreachable URL', async () => {
      const result = await httpRequest('http://localhost:19999/nonexistent', {
        method: 'GET',
        timeoutMs: 1000,
        maxRetries: 0,
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBeGreaterThanOrEqual(400);
    });

    it('should respect maxRetries:0 and not retry', async () => {
      const start = Date.now();
      await httpRequest('http://localhost:19999/fail', {
        method: 'GET',
        timeoutMs: 500,
        maxRetries: 0,
      });
      const elapsed = Date.now() - start;
      // maxRetries:0 ile sadece 1 deneme: timeout'tan kısa sürmeli
      expect(elapsed).toBeLessThan(3000);
    });

    it('should include retries count in result', async () => {
      const result = await httpRequest('http://localhost:19999/fail', {
        method: 'GET',
        timeoutMs: 300,
        maxRetries: 1,
      });
      expect(result.retries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('circuit breaker', () => {
    it('should return circuit breaker status as object', () => {
      const status = getCircuitBreakerStatus();
      expect(typeof status).toBe('object');
    });

    it('should block requests when circuit is open', async () => {
      // 5 ardışık hata ile devreyi aç
      for (let i = 0; i < 6; i++) {
        await httpRequest('http://localhost:19999/cb-test', {
          method: 'GET',
          timeoutMs: 200,
          maxRetries: 0,
          circuitKey: 'test-circuit',
        });
      }

      // Devre açık olmalı
      const result = await httpRequest('http://localhost:19999/cb-test', {
        method: 'GET',
        timeoutMs: 200,
        maxRetries: 0,
        circuitKey: 'test-circuit',
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(503);
      expect(result.data.AlertMessage).toContain('circuit breaker');
    });
  });
});
