import { describe, expect, it } from 'vitest';
import { gorselYolu } from '@/components/player/LobiKartAkisi';
import { LOBI_SAYFALARI, eksikLobiSayfalari, varsayilanLobiSayfalari } from './lobiSayfalari';

describe('LOBI_SAYFALARI', () => {
  it('kimlikler benzersiz', () => {
    const kimlikler = LOBI_SAYFALARI.map((s) => s.id);
    expect(new Set(kimlikler).size).toBe(kimlikler.length);
  });

  it('kasa ve ozel-oran listede', () => {
    // Panelin eski varsayilan listesinde bu ikisi yoktu; kartlar
    // eklendigi halde hicbir kiracida gorunmuyordu.
    const kimlikler = LOBI_SAYFALARI.map((s) => s.id);
    expect(kimlikler).toContain('kasa');
    expect(kimlikler).toContain('ozel-oran');
  });

  it('her sayfanin kart gorseli VAR', () => {
    // Asil koruma bu: gorseli olmayan bir sayfa lobide yedek dosemeyle
    // cikar ve tasarim bozulur. Yeni sayfa eklenirken gorseli de
    // eklenmis olmali.
    for (const sayfa of LOBI_SAYFALARI) {
      expect(gorselYolu(sayfa.id, 'standard'), sayfa.id).not.toBeNull();
      expect(gorselYolu(sayfa.id, 'mobile'), sayfa.id).not.toBeNull();
    }
  });

  it('her sayfanin yolu kok isaretiyle basliyor', () => {
    for (const sayfa of LOBI_SAYFALARI) {
      expect(sayfa.to.startsWith('/'), sayfa.id).toBe(true);
    }
  });
});

describe('varsayilanLobiSayfalari', () => {
  it('KOPYA donuyor -- duzenleme paylasilan listeye sizmiyor', () => {
    const a = varsayilanLobiSayfalari();
    a[0].label = 'degistirildi';
    expect(varsayilanLobiSayfalari()[0].label).not.toBe('degistirildi');
    expect(LOBI_SAYFALARI[0].label).not.toBe('degistirildi');
  });
});

describe('eksikLobiSayfalari', () => {
  it('kayitli listede olmayanlari donuyor', () => {
    const eksik = eksikLobiSayfalari([{ id: 'bonus' }, { id: 'wheel' }]);
    expect(eksik.map((s) => s.id)).toContain('kasa');
    expect(eksik.map((s) => s.id)).toContain('ozel-oran');
    expect(eksik.map((s) => s.id)).not.toContain('bonus');
  });

  it('tam listede bos donuyor', () => {
    expect(eksikLobiSayfalari(LOBI_SAYFALARI)).toEqual([]);
  });

  it('YENIDEN ADLANDIRILMIS karti eksik saymiyor', () => {
    // Karsilastirma kimlige gore; operatör adi/rengi degistirmis olabilir.
    const eksik = eksikLobiSayfalari([{ id: 'kasa', label: 'Patron Kasasi' } as never]);
    expect(eksik.map((s) => s.id)).not.toContain('kasa');
  });

  it('bos/bozuk girdide TUM sayfalari eksik sayiyor', () => {
    expect(eksikLobiSayfalari(null)).toHaveLength(LOBI_SAYFALARI.length);
    expect(eksikLobiSayfalari([])).toHaveLength(LOBI_SAYFALARI.length);
    expect(eksikLobiSayfalari([{ id: '  ' }])).toHaveLength(LOBI_SAYFALARI.length);
  });
});
