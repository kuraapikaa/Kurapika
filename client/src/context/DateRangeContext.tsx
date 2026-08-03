import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { DateRange } from '../api/client';
import { kasaGunKodu } from '../lib/kasaGunu';
import { onayarAraligi } from '../lib/datePresets';

/**
 * Panonun tarih penceresi.
 *
 * ── Bildirilen sorun ──────────────────────────────────────────────────
 *
 * "Dashboard hâlâ yanlış gösteriyor, bugün 11.000 yatırım var." Lynon
 * gerçekten 11.000 döndürüyordu; pano BAŞKA BİR GÜNÜ soruyordu.
 *
 * Varsayılan aralık MODÜL YÜKLENİRKEN bir kez hesaplanan bir sabitti:
 *
 *   const defaultRange = { startDate: todayYMD(), endDate: todayYMD() };
 *
 * Iki sonucu vardı. Birincisi `todayYMD()` TARAYICI yerel saatini
 * kullanıyordu — kasa günü Türkiye saatine göre. Ikincisi ve asıl
 * ağırlıklısı: sabit bir kez hesaplandığı için panel açık bırakılıp
 * gece yarısı geçildiğinde aralık DÜNDE KALIYOR, üstelik "Bugün" rozeti
 * yanmaya devam ediyordu. Operatör paneli günlerce açık tutuyor.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * Hazır bir aralık seçiliyken (`activePresetId` dolu) pencere GÜN
 * DEĞİŞTİĞİNDE yeniden hesaplanır. Elle tarih girildiyse (preset yok)
 * kullanıcının seçimine dokunulmaz — orada gün değişimi bir hata değil,
 * bilinçli bir tercih.
 */

/** Gün değişimini yakalama sıklığı. Dakikada bir yeterli; yük yok. */
const GUN_KONTROL_MS = 60_000;

function bugununAraligi(): DateRange {
  const g = kasaGunKodu();
  return { startDate: g, endDate: g };
}

type DateRangeContextValue = {
  dateRange: DateRange;
  setDateRange: (range: DateRange, presetId?: string) => void;
  activePresetId: string | null;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  // Modül yüklenirken değil, sağlayıcı kurulurken hesaplanır.
  const [dateRange, setDateRangeState] = useState<DateRange>(bugununAraligi);
  const [activePresetId, setActivePresetId] = useState<string | null>('today');

  const setDateRange = useCallback((range: DateRange, presetId?: string) => {
    setDateRangeState(range);
    setActivePresetId(presetId || null);
  }, []);

  /**
   * Gün dönümünde hazır aralığı tazele.
   *
   * `activePresetId` bir ref'te tutulur: efekt her preset değişiminde
   * yeniden kurulmasın, zamanlayıcı sıfırlanmasın diye.
   */
  const presetRef = useRef(activePresetId);
  presetRef.current = activePresetId;

  useEffect(() => {
    let sonGun = kasaGunKodu();

    const tazele = () => {
      const bugun = kasaGunKodu();
      if (bugun === sonGun) return;
      sonGun = bugun;
      const yeni = onayarAraligi(presetRef.current);
      // Elle seçilmiş aralığa dokunulmaz.
      if (yeni) setDateRangeState(yeni);
    };

    const timer = setInterval(tazele, GUN_KONTROL_MS);
    // Uyku/arka plan sekmede setInterval geciktiği için odakta da bak.
    window.addEventListener('focus', tazele);
    document.addEventListener('visibilitychange', tazele);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tazele);
      document.removeEventListener('visibilitychange', tazele);
    };
  }, []);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, activePresetId }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
