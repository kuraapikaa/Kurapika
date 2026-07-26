import { config } from '../config.js';
import { getBackofficeToken } from '../lib/authStore.js';
import { isLynonConfigured, lynonFindPlayerByLogin } from '../services/lynonBackofficeService.js';

const clientsApi = config.clientsApi as { baseUrl: string; path: string };

/**
 * BetConstruct GetClients API ile oyuncu login araması.
 * Bonus Panel girişinde kullanılır.
 */
export async function findClientByLogin(login: string): Promise<boolean> {
  if (isLynonConfigured()) {
    try {
      const player = await lynonFindPlayerByLogin(login);
      if (player) {
        console.log(`[bonus-panel] Oyuncu Lynon API ile bulundu: "${login}" (ID: ${player.Id ?? 'N/A'})`);
        return true;
      }
      console.warn(`[bonus-panel] Oyuncu Lynon API ile bulunamadı: "${login}"`);
      return false;
    } catch (err) {
      console.warn('[bonus-panel] Lynon oyuncu sorgusu başarısız; eski token akışı deneniyor.', err);
    }
  }

  const token = getBackofficeToken();
  if (!token) {
    console.error('[bonus-panel] Hata: BetConstruct token bulunamadı.');
    return false;
  }

  const url = `${clientsApi.baseUrl.replace(/\/$/, '')}/${clientsApi.path.replace(/^\//, '')}`;
  console.log(`[bonus-panel] Oyuncu sorgulanıyor: "${login}" -> URL: ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json',
        'authentication': token.trim(),
      },
      body: JSON.stringify({ Login: login, MaxRows: 1, SkeepRows: 0 }),
    });

    const data = (await res.json()) as { HasError?: boolean; AlertMessage?: string; ErrorDescription?: string; Data?: { Objects?: unknown[] } };

    if (data?.HasError) {
      console.error(`[bonus-panel] BC API Hatası: ${data?.AlertMessage || data?.ErrorDescription}`);
      return false;
    }

    const objects = data?.Data?.Objects;
    const found = Array.isArray(objects) && objects.length > 0;

    if (found) {
      console.log(`[bonus-panel] Oyuncu bulundu: "${login}" (ID: ${(objects[0] as { Id?: number }).Id})`);
    } else {
      console.warn(`[bonus-panel] Oyuncu BULUNAMADI: "${login}"`);
    }

    return found;
  } catch (err) {
    console.error('[bonus-panel] Sorgu sırasında kritik hata:', err);
    return false;
  }
}
