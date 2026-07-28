import { gamesApi } from '../api/client';

/**
 * Lobi yapılandırması için "son bilinen iyi" önbellek.
 *
 * Sorun: lobi ve alt sayfaları önce DEFAULT_LOBBY_PALETTE ile boyanıyor, sonra
 * /api/games/config yanıtı gelince admin paletiyle yeniden boyanıyordu. Sayfa
 * her açılışta gözle görülür şekilde "önce eski, hemen ardından yeni" tasarımı
 * gösteriyordu.
 *
 * Çözüm: yanıt localStorage'a yazılır ve sonraki açılışlarda ilk boyama doğrudan
 * bu değerle yapılır. Ağ isteği yine atılır; sadece ilk kare artık doğru.
 * İlk ziyarette önbellek boş olduğu için varsayılanlar kullanılır (kaçınılmaz).
 */

const CACHE_KEY = 'narcos_games_config_v1';

// Aynı sekmede birden fazla bileşen aynı anda okuduğu için JSON.parse'ı
// tekrarlamamak adına modül düzeyinde de tutulur.
let memoryCache: any | undefined;

export function readCachedGamesConfig(): any | undefined {
  if (memoryCache !== undefined) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    // Beklenen kabuk: { ok: true, data: {...} }
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return undefined;
    memoryCache = parsed;
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeCachedGamesConfig(payload: any): void {
  if (!payload || typeof payload !== 'object' || !payload.data) return;
  memoryCache = payload;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Kota dolu veya depolama kapalı: önbellek olmadan da çalışır.
  }
}

/** gamesApi.config() + başarılı yanıtı önbelleğe yaz. */
export async function fetchGamesConfigCached(): Promise<any> {
  const res = await gamesApi.config();
  writeCachedGamesConfig(res);
  return res;
}
