import { describe, expect, it } from 'vitest';
import {
  KOPYALANMAYAN,
  ayniDegerMi,
  kuralKopyasiCikar,
  kuraliYapistir,
  yapistirmaFarki,
} from './kuralKopyala';

/** Gercekci bir kaynak kural: kimlik alanlari + ayarlar bir arada. */
const KAYNAK = {
  enabled: true,
  title: 'Carsamba Happy Days',
  type: 'partner' as const,
  partnerBonusId: '2499894',
  partnerBonusRanges: [{ min: 100, max: 500, partnerBonusId: '2499894' }],
  assignmentValues: { kampanyaAlani: 'A' },
  amountType: 'percentage' as const,
  percentageAmount: 50,
  maximumBonus: 5000,
  perDayLimit: 1,
  checkPendingWithdrawal: true,
  casinoWagering: 3,
};

const HEDEF = {
  enabled: false,
  title: '4. Yatirim Hediyesi',
  type: 'cash' as const,
  partnerBonusId: '1875',
  assignmentValues: { kampanyaAlani: 'B' },
  amountType: 'fixed' as const,
  fixedAmount: 250,
  perWeekLimit: 2,
  casinoWagering: 10,
};

describe('kuralKopyasiCikar', () => {
  it('kimlik alanlarini ALMIYOR', () => {
    const kopya = kuralKopyasiCikar(KAYNAK);
    for (const alan of Object.keys(KOPYALANMAYAN)) {
      expect(kopya).not.toHaveProperty(alan);
    }
  });

  it('ayar alanlarini aliyor', () => {
    const kopya = kuralKopyasiCikar(KAYNAK);
    expect(kopya).toMatchObject({
      amountType: 'percentage',
      percentageAmount: 50,
      maximumBonus: 5000,
      perDayLimit: 1,
      checkPendingWithdrawal: true,
      casinoWagering: 3,
    });
  });

  it('derin kopya aliyor -- kaynak sonradan degisince pano bozulmuyor', () => {
    const canli: any = { tieredAmounts: [{ min: 100, bonus: 50 }] };
    const kopya = kuralKopyasiCikar(canli);
    canli.tieredAmounts[0].bonus = 999;
    expect((kopya.tieredAmounts as any)[0].bonus).toBe(50);
  });

  it('bos/gecersiz girdide bos nesne donuyor', () => {
    expect(kuralKopyasiCikar(null)).toEqual({});
    expect(kuralKopyasiCikar(undefined)).toEqual({});
  });

  it('undefined alanlari tasimiyor', () => {
    expect(kuralKopyasiCikar({ perDayLimit: undefined, casinoWagering: 3 })).toEqual({ casinoWagering: 3 });
  });
});

describe('kuraliYapistir', () => {
  const kopya = kuralKopyasiCikar(KAYNAK);
  const sonuc = kuraliYapistir(HEDEF, kopya);

  it('hedefin KIMLIGINI koruyor', () => {
    // Asil koruma bu: `partnerBonusId` tasinsaydi hedef bonus,
    // kopyalandigi bonusun kampanyasini dagitmaya baslardi.
    expect(sonuc.partnerBonusId).toBe('1875');
    expect(sonuc.title).toBe('4. Yatirim Hediyesi');
    expect(sonuc.type).toBe('cash');
    expect(sonuc.assignmentValues).toEqual({ kampanyaAlani: 'B' });
  });

  it('kapali bir bonusu yapistirma ile ACMIYOR', () => {
    expect(sonuc.enabled).toBe(false);
  });

  it('ayarlari kaynaktakiyle esitliyor', () => {
    expect(sonuc.amountType).toBe('percentage');
    expect(sonuc.percentageAmount).toBe(50);
    expect(sonuc.casinoWagering).toBe(3);
  });

  it('kaynakta OLMAYAN hedef ayarlarini birakmıyor', () => {
    // Birlestirseydik hedefteki `perWeekLimit` ve `fixedAmount` yerinde
    // kalir, operatör kurallari esitledigini sanirken aralarinda
    // gorunmez bir fark kalirdi.
    expect(sonuc).not.toHaveProperty('perWeekLimit');
    expect(sonuc).not.toHaveProperty('fixedAmount');
  });

  it('sonuc kaynakla AYNI ayarlara sahip', () => {
    const sonucAyarlari = kuralKopyasiCikar(sonuc);
    expect(sonucAyarlari).toEqual(kopya);
  });

  it('kimligi olmayan hedefte de calisiyor', () => {
    expect(kuraliYapistir({}, kopya).percentageAmount).toBe(50);
    expect(kuraliYapistir(null, kopya).percentageAmount).toBe(50);
  });

  it('bos pano hedefin ayarlarini siliyor ama kimligini birakiyor', () => {
    const bosla = kuraliYapistir(HEDEF, {});
    expect(bosla.partnerBonusId).toBe('1875');
    expect(bosla).not.toHaveProperty('fixedAmount');
  });
});

describe('yapistirmaFarki', () => {
  const kopya = kuralKopyasiCikar(KAYNAK);
  const fark = yapistirmaFarki(HEDEF, kopya);
  const alanlari = (liste: Array<{ alan: string }>) => liste.map((d) => d.alan).sort();

  it('degisecek alanlari listeliyor', () => {
    expect(alanlari(fark.degisen)).toContain('percentageAmount');
    expect(alanlari(fark.degisen)).toContain('casinoWagering');
  });

  it('TEMIZLENECEK alanlari ayrica isaretliyor', () => {
    // Yapistirma yikici; operatör neyin silinecegini gormeden
    // onaylamamali.
    expect(fark.temizlenen.sort()).toEqual(['fixedAmount', 'perWeekLimit']);
  });

  it('eklenecek alanlari isaretliyor', () => {
    expect(fark.eklenen).toContain('perDayLimit');
    expect(fark.eklenen).toContain('percentageAmount');
  });

  it('dokunulmayan kimlik alanlarini bildiriyor', () => {
    expect(fark.atlanan).toContain('partnerBonusId');
    expect(fark.atlanan).toContain('title');
  });

  it('ayni degerdeki alani DEGISEN saymiyor', () => {
    const ayni = yapistirmaFarki({ casinoWagering: 3 }, { casinoWagering: 3 });
    expect(ayni.degisen).toEqual([]);
  });

  it('ayni kurala yapistirmada hicbir degisiklik cikmiyor', () => {
    const kendine = yapistirmaFarki(KAYNAK, kuralKopyasiCikar(KAYNAK));
    expect(kendine.degisen).toEqual([]);
    expect(kendine.temizlenen).toEqual([]);
  });

  it('bildirilen fark, gercekten uygulanan sonucla tutarli', () => {
    // Onizleme ile sonuc ayrissa onizleme yalan soyluyor demektir.
    const sonuc = kuraliYapistir(HEDEF, kopya) as Record<string, unknown>;
    for (const { alan, yeni } of fark.degisen) {
      expect(sonuc[alan]).toEqual(yeni);
    }
    for (const alan of Object.keys(HEDEF)) {
      const dokunuldu = fark.degisen.some((d) => d.alan === alan);
      if (!dokunuldu) {
        expect(sonuc[alan]).toEqual((HEDEF as Record<string, unknown>)[alan]);
      }
    }
  });
});

describe('freespin grubu', () => {
  it('freespin alanlari kopyalanmiyor', () => {
    const kopya = kuralKopyasiCikar({
      freespinCount: 100, freespinBetLevel: 2,
      freespinGameId: 55, freespinGameProviderId: 7, freespinGame: { id: 55, providerId: 7 },
      casinoWagering: 3,
    });
    expect(kopya).toEqual({ casinoWagering: 3 });
  });

  it('freespin kurali yapistirilinca hedefin kendi ayari duruyor', () => {
    const kaynak = { freespinCount: 100, freespinGameId: 55, freespinGameProviderId: 7, casinoWagering: 3 };
    const hedef = { freespinCount: 25, freespinGameId: 91, freespinGameProviderId: 4, casinoWagering: 10 };
    const sonuc = kuraliYapistir(hedef, kuralKopyasiCikar(kaynak));
    expect(sonuc.freespinCount).toBe(25);
    expect(sonuc.freespinGameId).toBe(91);
    expect(sonuc.casinoWagering).toBe(3);
  });

  it('freespinsiz hedefe YARIM freespin ayari birakmiyor', () => {
    // Sunucu `BetLevel`/`RoundCount` doluyken gecerli bir `Game` ariyor
    // ve bulamazsa KAYDI REDDEDIYOR; yarim tasima yapistirmayi tamamen
    // calismaz yapardi.
    const sonuc = kuraliYapistir(
      { partnerBonusId: '1875', casinoWagering: 10 },
      kuralKopyasiCikar({ freespinCount: 100, freespinBetLevel: 2, casinoWagering: 3 }),
    ) as Record<string, unknown>;
    expect(sonuc.freespinCount).toBeUndefined();
    expect(sonuc.freespinBetLevel).toBeUndefined();
  });
});

describe('ayniDegerMi', () => {
  it('nesneleri icerige gore karsilastiriyor', () => {
    expect(ayniDegerMi([{ min: 1 }], [{ min: 1 }])).toBe(true);
    expect(ayniDegerMi([{ min: 1 }], [{ min: 2 }])).toBe(false);
  });

  it('null ile undefined ayni sayiliyor', () => {
    // Panelde "bos" ile "hic yok" ayni sey; ayirmak sahte fark uretirdi.
    expect(ayniDegerMi(null, undefined)).toBe(true);
  });

  it('bos deger ile dolu degeri ayiriyor', () => {
    expect(ayniDegerMi(null, 0)).toBe(false);
    expect(ayniDegerMi(undefined, false)).toBe(false);
  });
});
