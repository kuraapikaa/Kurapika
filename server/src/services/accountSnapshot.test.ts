import { describe, it, expect } from 'vitest';
import { parseDateToTime } from '../services/accountSnapshotService.js';

describe('parseDateToTime', () => {
  it('should parse DD/MM/YYYY format', () => {
    const ts = parseDateToTime('15/03/2024');
    const d = new Date(ts);
    expect(d.getDate()).toBe(15);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getFullYear()).toBe(2024);
  });

  it('should parse DD-MM-YY format', () => {
    const ts = parseDateToTime('01-06-25');
    const d = new Date(ts);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5);
    expect(d.getFullYear()).toBe(2025);
  });

  it('should parse YYYY-MM-DD format', () => {
    const ts = parseDateToTime('2024-12-25');
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
  });

  it('should parse DD.MM.YYYY HH:MM:SS format', () => {
    const ts = parseDateToTime('10.01.2025 14:30:45');
    const d = new Date(ts);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(45);
  });

  it('should parse ISO format with T', () => {
    const ts = parseDateToTime('2025-06-15T09:00:00');
    expect(ts).toBeGreaterThan(0);
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(5);
  });

  it('should return 0 for null/undefined/empty', () => {
    expect(parseDateToTime(null)).toBe(0);
    expect(parseDateToTime(undefined)).toBe(0);
    expect(parseDateToTime('')).toBe(0);
    expect(parseDateToTime('   ')).toBe(0);
  });

  it('should return 0 for invalid date string', () => {
    expect(parseDateToTime('not-a-date')).toBe(0);
  });
});
