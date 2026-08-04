import { describe, expect, it } from 'vitest';
import { escapeHtml, gorselMesaj, kalinSatir } from './telegramService.js';

describe('escapeHtml', () => {
  it('&, < ve > karakterlerini kaçar', () => {
    expect(escapeHtml('Tom & Jerry <script>')).toBe('Tom &amp; Jerry &lt;script&gt;');
  });

  it('null/undefined boş string döner, çökmez', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('zararsız metni değiştirmez', () => {
    expect(escapeHtml('larac · 3.000 TRY')).toBe('larac · 3.000 TRY');
  });
});

describe('gorselMesaj', () => {
  it('**...** ile sarmalanmış satırı <b> etiketine çevirir', () => {
    expect(gorselMesaj([kalinSatir('📊 KASA ÖZETİ')])).toBe('<b>📊 KASA ÖZETİ</b>');
  });

  it('kalın satırın içeriğini de kaçar', () => {
    expect(gorselMesaj([kalinSatir('Tom & Jerry')])).toBe('<b>Tom &amp; Jerry</b>');
  });

  it('dinamik değerdeki < > & karakterleri Telegram\'ı kırmadan kaçılır', () => {
    const mesaj = gorselMesaj([kalinSatir('BAŞLIK'), `👤 ${'<script>alert(1)</script>'}`]);
    expect(mesaj).toBe('<b>BAŞLIK</b>\n👤 &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('null/undefined satırları atlar, boş satırları (spacing) korur', () => {
    expect(gorselMesaj(['a', null, '', undefined, 'b'])).toBe('a\n\nb');
  });

  it('normal satırları olduğu gibi bırakır', () => {
    expect(gorselMesaj(['👤 larac (12345)', '💸 3.000 TRY'])).toBe('👤 larac (12345)\n💸 3.000 TRY');
  });
});
