import { describe, expect, it } from 'vitest';

/** app.ts içindeki ayrıştırma mantığının birebir kopyası */
function parse(env: string | undefined) {
  const list = (env ?? '').split(/[\s,]+/).map(v => v.trim()).filter(Boolean);
  return {
    directive: list.length > 0 ? ["'self'", ...list] : ["'self'"],
    gomulebilir: list.length > 0,
  };
}

describe('FRAME_ANCESTORS ayrıştırma', () => {
  it('tanımsızsa yalnızca self — güvenli varsayılan', () => {
    const r = parse(undefined);
    expect(r.directive).toEqual(["'self'"]);
    expect(r.gomulebilir).toBe(false);
  });

  it('boş dizede de self', () => {
    expect(parse('   ').gomulebilir).toBe(false);
  });

  it('boşlukla ayrılmış listeyi okur', () => {
    const r = parse('https://narcosbahis.com https://narcosbahis481.com');
    expect(r.directive).toEqual(["'self'", 'https://narcosbahis.com', 'https://narcosbahis481.com']);
    expect(r.gomulebilir).toBe(true);
  });

  it('virgülle ayrılmış listeyi de okur', () => {
    expect(parse('https://a.com, https://b.com').directive)
      .toEqual(["'self'", 'https://a.com', 'https://b.com']);
  });

  it('self her zaman listede kalır', () => {
    expect(parse('https://a.com').directive[0]).toBe("'self'");
  });

  it('fazladan boşluk/satır sonu temizlenir', () => {
    expect(parse('  https://a.com \n https://b.com  ').directive)
      .toEqual(["'self'", 'https://a.com', 'https://b.com']);
  });
});
