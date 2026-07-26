import { describe, it, expect } from 'vitest';
import { cn, resolveTeamLogoUrl } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', true && 'block')).toBe('base block');
  });
});

describe('resolveTeamLogoUrl', () => {
  it('returns null for empty or missing logo values', () => {
    expect(resolveTeamLogoUrl('')).toBeNull();
    expect(resolveTeamLogoUrl('   ')).toBeNull();
    expect(resolveTeamLogoUrl(undefined)).toBeNull();
  });

  it('returns a trimmed logo URL when provided', () => {
    expect(resolveTeamLogoUrl(' https://cdn.example.com/team.png ')).toBe('https://cdn.example.com/team.png');
  });
});
