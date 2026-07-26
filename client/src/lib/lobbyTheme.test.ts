import { describe, expect, it } from 'vitest';
import { asHexColor, normalizeLobbyPalette, DEFAULT_LOBBY_PALETTE } from './lobbyTheme';
import { normalizeLobbyPageContent } from './lobbyContent';

/** useLobbyPageTheme içindeki accent ezme kuralının birebir kopyası. */
function resolveAccent(lobby: any, pageId: string) {
  const base = normalizeLobbyPalette(lobby);
  const pageAccent = asHexColor(lobby?.pages?.[pageId]?.accentColor, '');
  return pageAccent ? { ...base, accentColor: pageAccent } : base;
}

describe('lobi teması', () => {
  it('admin renklerini config’ten okur', () => {
    const p = normalizeLobbyPalette({
      primaryColor: '#8b5cf6',
      secondaryColor: '#6d28d9',
      accentColor: '#c4b5fd',
      backgroundColor: '#0b0713',
    });
    expect(p.primaryColor).toBe('#8b5cf6');
    expect(p.accentColor).toBe('#c4b5fd');
    expect(p.backgroundColor).toBe('#0b0713');
  });

  it('geçersiz/eksik rengi varsayılana düşürür', () => {
    const p = normalizeLobbyPalette({ primaryColor: 'mavi', accentColor: '' });
    expect(p.primaryColor).toBe(DEFAULT_LOBBY_PALETTE.primaryColor);
    expect(p.accentColor).toBe(DEFAULT_LOBBY_PALETTE.accentColor);
  });

  it('kısa hex (#abc) biçimini kabul eder', () => {
    expect(normalizeLobbyPalette({ primaryColor: '#abc' }).primaryColor).toBe('#abc');
  });

  it('backgroundOverlay değerini 0-95 aralığına sıkıştırır', () => {
    expect(normalizeLobbyPalette({ backgroundOverlay: 300 }).backgroundOverlay).toBe(95);
    expect(normalizeLobbyPalette({ backgroundOverlay: -20 }).backgroundOverlay).toBe(0);
  });
});

describe('sayfa başına vurgu rengi', () => {
  const lobby = {
    primaryColor: '#8b5cf6',
    accentColor: '#c4b5fd',
    pages: {
      wheel: { accentColor: '#ec4899' },
      scratch: { accentColor: '' },
      bonus: { accentColor: 'gecersiz' },
    },
  };

  it('tanımlıysa global accent’i ezer', () => {
    expect(resolveAccent(lobby, 'wheel').accentColor).toBe('#ec4899');
  });

  it('ezme sadece accent’i etkiler, diğer renkler global kalır', () => {
    expect(resolveAccent(lobby, 'wheel').primaryColor).toBe('#8b5cf6');
  });

  it('boş bırakılırsa global accent devralınır', () => {
    expect(resolveAccent(lobby, 'scratch').accentColor).toBe('#c4b5fd');
  });

  it('geçersiz değer global accent’e düşer', () => {
    expect(resolveAccent(lobby, 'bonus').accentColor).toBe('#c4b5fd');
  });

  it('hiç tanımlı olmayan sayfa global accent kullanır', () => {
    expect(resolveAccent(lobby, 'call-me').accentColor).toBe('#c4b5fd');
  });

  it('accentColor sayfa içeriğinde normalize edilerek korunur', () => {
    expect(normalizeLobbyPageContent('wheel', { accentColor: '#ec4899' } as any).accentColor).toBe('#ec4899');
    expect(normalizeLobbyPageContent('wheel', { accentColor: 'bozuk' } as any).accentColor).toBe('');
  });
});
