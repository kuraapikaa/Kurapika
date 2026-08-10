import { describe, expect, it } from 'vitest';
import {
  escapeHtml, gorselMesaj, kalinIsaretle, kalinSatir, kodIsaretle, onIzgaraBlogu,
} from './telegramService.js';

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

  it('kalinIsaretle ile satırın YALNIZCA bir kısmını <b> yapar', () => {
    expect(gorselMesaj([`${kalinIsaretle('❓ Not:')} test hesapları işaretli.`]))
      .toBe('<b>❓ Not:</b> test hesapları işaretli.');
  });

  it('kodIsaretle ile satır içi <code> üretir, geri kalanı düz kalır', () => {
    expect(gorselMesaj([`📅 ${kodIsaretle('10.08.2026 · 08:26')}`]))
      .toBe('📅 <code>10.08.2026 · 08:26</code>');
  });

  it('kalinIsaretle/kodIsaretle içeriğini de kaçar', () => {
    expect(gorselMesaj([kalinIsaretle('Tom & Jerry')])).toBe('<b>Tom &amp; Jerry</b>');
    expect(gorselMesaj([kodIsaretle('a < b')])).toBe('<code>a &lt; b</code>');
  });

  it('onIzgaraBlogu birden çok satırı TEK bir <pre> bloğu yapar', () => {
    const mesaj = gorselMesaj([onIzgaraBlogu(['satır 1', 'satır 2'])]);
    expect(mesaj).toBe('<pre>satır 1\nsatır 2</pre>');
  });

  it('onIzgaraBlogu içeriğini de kaçar', () => {
    expect(gorselMesaj([onIzgaraBlogu(['<script>x</script>'])])).toBe('<pre>&lt;script&gt;x&lt;/script&gt;</pre>');
  });

  it('gerçek raporda geçebilecek düz metin işaretlerle karışmaz', () => {
    // Kullanıcı adında/açıklamada rastgele yıldız ya da backtick olsa
    // bile isaretler ozel, nadir karakter dizileri kullandığı için
    // yanlışlıkla <b>/<code>'ya dönüşmez.
    expect(gorselMesaj(['kullanici*adi`test`'])).toBe('kullanici*adi`test`');
  });
});
