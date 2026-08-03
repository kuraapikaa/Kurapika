import type { DateRange } from '../api/client';
import { ayBasi, aySonu, gunEkle, haftaBasi, kasaGunKodu, oncekiAyBasi } from './kasaGunu';

/**
 * TARIH SAAT DILIMI.
 *
 * Bu hazir araliklar TARAYICININ yerel saat dilimini kullaniyordu.
 * Kasanin is gunu ise Turkiye saatine gore. Operatorun makinesi baska
 * bir dilimdeyse (ya da isletim sistemi UTC ise) "Bugun" kasanin
 * bugununden farkli bir gun secip raporu yanlis gosteriyordu.
 *
 * Gun aritmetigi de yerel `Date` uzerinde yapiliyordu: yerel gece
 * yarisini Istanbul dilimine geri cevirmek, Istanbul'un DOGUSUNDAKI
 * tarayicilarda bir gun geri kaydiriyordu. Artik saat diliminden cikis
 * yalnizca `kasaGunKodu()` icinde; gerisi "YYYY-MM-DD" metni uzerinde
 * saf aritmetik ve tarayicinin diliminden bagimsiz.
 */
export type Onayar = { id: string; label: string; getRange: () => DateRange };

/** Tum zamanlar araliginin baslangici — kasadan onceki her sey. */
const BASLANGIC = '2000-01-01';

export function getPresetRanges(): Onayar[] {
  return [
    {
      id: 'today',
      label: 'Bugün',
      getRange: () => {
        const g = kasaGunKodu();
        return { startDate: g, endDate: g };
      },
    },
    {
      id: 'yesterday',
      label: 'Dün',
      getRange: () => {
        const g = gunEkle(kasaGunKodu(), -1);
        return { startDate: g, endDate: g };
      },
    },
    {
      id: 'thisWeek',
      label: 'Bu hafta',
      getRange: () => {
        const bugun = kasaGunKodu();
        return { startDate: haftaBasi(bugun), endDate: bugun };
      },
    },
    {
      id: 'lastWeek',
      label: 'Geçen hafta',
      getRange: () => {
        const gecenHaftaSonu = gunEkle(haftaBasi(kasaGunKodu()), -1);
        return { startDate: haftaBasi(gecenHaftaSonu), endDate: gecenHaftaSonu };
      },
    },
    {
      id: 'thisMonth',
      label: 'Bu ay',
      getRange: () => {
        const bugun = kasaGunKodu();
        return { startDate: ayBasi(bugun), endDate: bugun };
      },
    },
    {
      id: 'lastMonth',
      label: 'Geçen ay',
      getRange: () => {
        const gecenAy = oncekiAyBasi(kasaGunKodu());
        return { startDate: gecenAy, endDate: aySonu(gecenAy) };
      },
    },
    {
      id: 'allTime',
      label: 'Tüm zamanlar',
      getRange: () => ({ startDate: BASLANGIC, endDate: kasaGunKodu() }),
    },
  ];
}

/** Kimlikten hazir araligi bulur; bilinmeyen kimlik icin null. */
export function onayarAraligi(id: string | null | undefined): DateRange | null {
  if (!id) return null;
  return getPresetRanges().find((o) => o.id === id)?.getRange() ?? null;
}
