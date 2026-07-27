import { describe, expect, it } from 'vitest';

/** index.ts içindeki cacheControlFor mantığının birebir kopyası */
const cacheControlFor = (resolvedPath: string, ext: string): string => {
  if (ext === '.html') return 'no-cache, must-revalidate';
  const hashli = /[.-][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(resolvedPath);
  return hashli ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
};

describe('statik dosya önbellek politikası', () => {
  it('HTML önbelleğe alınmaz — CSP yanıtla taşındığı için kritik', () => {
    expect(cacheControlFor('/app/client/dist/index.html', '.html'))
      .toBe('no-cache, must-revalidate');
  });

  it('hash içeren varlıklar kalıcı önbelleğe alınır', () => {
    const kalici = 'public, max-age=31536000, immutable';
    expect(cacheControlFor('/dist/assets/index-pzdcQmfi.js', '.js')).toBe(kalici);
    expect(cacheControlFor('/dist/assets/index-DQGsF_NE.css', '.css')).toBe(kalici);
    expect(cacheControlFor('/dist/assets/PlayerProfile-CTPj-FaL.js', '.js')).toBe(kalici);
  });

  it('hash taşımayan dosyalar kısa süre önbelleklenir', () => {
    expect(cacheControlFor('/dist/vite.svg', '.svg')).toBe('public, max-age=3600');
    expect(cacheControlFor('/dist/favicon.ico', '.ico')).toBe('public, max-age=3600');
  });

  it('kısa adlı dosya hash sanılmaz', () => {
    expect(cacheControlFor('/dist/app.js', '.js')).toBe('public, max-age=3600');
  });
});
