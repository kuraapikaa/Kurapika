/**
 * Tamamlanan gunluk gorevlerin lobide bir kez duyurulmasi.
 *
 * Sunucu her gorev icin `completed` ve `claimed` doner, ama "bu oyuncuya
 * daha once haber verdik mi" bilgisini tutmaz. Bunu tarayicida tutuyoruz:
 * kayit yalnizca bildirim gecmisi, odul hakki degil — silinirse en kotu
 * ihtimalle ayni bildirim tekrar cikar, hak kaybi olmaz.
 *
 * Anahtar gune gore ayrilir (dateKey), boylece ertesi gun ayni gorev
 * yeniden duyurulabilir ve depo kendiliginden kucuk kalir.
 */

const ONEK = 'narcos-gorev-bildirim';

function anahtar(dateKey: string): string {
  return `${ONEK}:${dateKey}`;
}

function oku(dateKey: string): string[] {
  try {
    const ham = localStorage.getItem(anahtar(dateKey));
    const dizi = ham ? JSON.parse(ham) : [];
    return Array.isArray(dizi) ? dizi.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function yaz(dateKey: string, idler: string[]): void {
  try {
    localStorage.setItem(anahtar(dateKey), JSON.stringify(idler));
  } catch {
    /* depolama kapali olabilir; bildirim tekrar cikar, islev bozulmaz */
  }
}

/** Gunu degisen eski kayitlari temizler; tarayicida birikmesinler. */
function eskileriSil(gecerliDateKey: string): void {
  try {
    const silinecek: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${ONEK}:`) && k !== anahtar(gecerliDateKey)) silinecek.push(k);
    }
    silinecek.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* yok say */
  }
}

export type DuyurulacakGorev = { id: string; title: string; rewardLabel?: string };

/**
 * Henuz duyurulmamis, tamamlanmis gorevleri dondurur ve duyurulmus olarak
 * isaretler. Ayni cagri iki kez yapilirsa ikincisi bos doner.
 */
export function yeniTamamlananlar(
  dateKey: string,
  tasks: Array<{ id?: unknown; title?: unknown; completed?: unknown; claimed?: unknown; rewardLabel?: unknown }>,
): DuyurulacakGorev[] {
  if (!dateKey) return [];
  eskileriSil(dateKey);

  const duyurulmus = new Set(oku(dateKey));
  const yeni: DuyurulacakGorev[] = [];

  for (const task of tasks ?? []) {
    const id = String(task?.id ?? '').trim();
    if (!id || duyurulmus.has(id)) continue;
    // Odulu alinmis gorev icin bildirim anlamsiz; oyuncu zaten islemi yapti.
    if (task?.completed !== true || task?.claimed === true) continue;
    yeni.push({
      id,
      title: String(task?.title ?? 'Görev'),
      rewardLabel: task?.rewardLabel ? String(task.rewardLabel) : undefined,
    });
    duyurulmus.add(id);
  }

  if (yeni.length > 0) yaz(dateKey, Array.from(duyurulmus));
  return yeni;
}
