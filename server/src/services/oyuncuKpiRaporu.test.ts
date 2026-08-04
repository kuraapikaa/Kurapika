import { describe, expect, it } from 'vitest';
import { oyuncuAdaylariMesaji, oyuncuBulunamadiMesaji, oyuncuKpiMesaji, type OyuncuKpiOzeti } from './oyuncuKpiRaporu.js';

const taban: OyuncuKpiOzeti = {
  id: '2503142',
  login: 'larac',
  telefon: '+905551234567',
  eposta: 'larac@example.com',
  kayitTarihi: '2026-06-01T10:00:00Z',
  telefonDogrulandi: true,
  epostaDogrulandi: false,
  kimlikDogrulandi: null,
  kategori: 'VIP',
  paraBirimi: 'TRY',
  gercekBakiye: 1250.5,
  bonusBakiye: 300,
  toplamBakiye: 1550.5,
  toplamYatirim: 10000,
  toplamCekim: 4000,
};

describe('oyuncuKpiMesaji', () => {
  it('login ve id başlıkta görünür', () => {
    const mesaj = oyuncuKpiMesaji(taban);
    expect(mesaj).toContain('larac (2503142)');
  });

  it('doğrulama durumları doğru işaretlenir', () => {
    const mesaj = oyuncuKpiMesaji(taban);
    expect(mesaj).toMatch(/Telefon:\s+✅/);
    expect(mesaj).toMatch(/E-posta:\s+❌/);
    expect(mesaj).toMatch(/Kimlik:\s+❔/);
  });

  it('bakiye ve yatırım/çekim tutarları biçimlendirilir', () => {
    const mesaj = oyuncuKpiMesaji(taban);
    expect(mesaj).toContain('1.250,5 TRY');
    expect(mesaj).toContain('10.000 TRY');
    expect(mesaj).toContain('4.000 TRY');
  });

  it('kasaya karşı yatırım fazlaysa "önde" yazar', () => {
    const mesaj = oyuncuKpiMesaji(taban);
    expect(mesaj).toContain('önde');
  });

  it('kasaya karşı çekim fazlaysa "geride" yazar', () => {
    const mesaj = oyuncuKpiMesaji({ ...taban, toplamYatirim: 1000, toplamCekim: 4000 });
    expect(mesaj).toContain('geride');
  });

  it('yatırım/çekim verisi yoksa "—" yazar, çökmez', () => {
    const mesaj = oyuncuKpiMesaji({ ...taban, toplamYatirim: null, toplamCekim: null });
    expect(mesaj).toContain('Kasaya karşı: —');
  });

  it('eksik telefon/eposta "—" olarak gösterilir', () => {
    const mesaj = oyuncuKpiMesaji({ ...taban, telefon: null, eposta: null });
    expect(mesaj).toMatch(/Telefon:\s+✅ —/);
    expect(mesaj).toMatch(/E-posta:\s+❌ —/);
  });
});

describe('oyuncuAdaylariMesaji', () => {
  it('birden fazla adayı listeler', () => {
    const mesaj = oyuncuAdaylariMesaji('lar', [
      { id: '1', login: 'larac', telefon: '5551234567' },
      { id: '2', login: 'laracik', telefon: null },
    ]);
    expect(mesaj).toContain('larac (1)');
    expect(mesaj).toContain('laracik (2)');
    expect(mesaj).toContain('2)');
  });

  it('8den fazla adayda kalanı özetler', () => {
    const adaylar = Array.from({ length: 10 }, (_, i) => ({ id: String(i), login: `k${i}`, telefon: null }));
    const mesaj = oyuncuAdaylariMesaji('k', adaylar);
    expect(mesaj).toContain('2 eşleşme daha');
  });
});

describe('oyuncuBulunamadiMesaji', () => {
  it('sorgu metnini içerir', () => {
    expect(oyuncuBulunamadiMesaji('05551234567')).toContain('05551234567');
  });
});
