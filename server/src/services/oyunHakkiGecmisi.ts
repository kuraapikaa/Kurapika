/**
 * Oyun haklarini GERIYE DONUK isletmek.
 *
 * ── Sorun ─────────────────────────────────────────────────────────────
 * "Bir yatirim = bir hak" kurali yerel oynama kayitlarina bakiyor. Kural
 * yururluge girmeden ONCE oynanan turlar bu kaydi tasimadigi icin eski
 * yatirimlar "kullanilmamis" gorunuyor: her oyuncu son yatirimiyla bir
 * kez daha oynayabiliyor.
 *
 * Kural Lynon gecmisinden okuyan digerlerinden farkli. Kayip tabani ve
 * nakit bonus limitleri odeme/duzeltme gecmisine baktigi icin zaten
 * geriye donuk; bu degil.
 *
 * ── Cozum ─────────────────────────────────────────────────────────────
 * Gecmis oynamalari yatirimlarla ZAMANA gore eslestirip kayitlara
 * `depositId` yaziyoruz. Bir oynama, o anda gecerli olan (oynamadan
 * onceki EN YAKIN) yatirimi tuketmis sayilir.
 *
 * ── Kapsam siniri ─────────────────────────────────────────────────────
 * Kazi kazanda oynama kaydi hic tutulmuyordu. KAZANAN turlar Lynon
 * kampanya atamasi biraktigi icin geri kazanilabiliyor; KAYBEDEN turlar
 * hicbir yerde iz birakmiyor ve kurtarilamaz. Bu, kurali gecmise
 * yaymanin sinirini olusturuyor ve rapora acikca yaziliyor.
 */

export type GecmisOynama = {
  /** Kayit kimligi; guncelleme bunun uzerinden yapilir. */
  id: string;
  username: string;
  /** Oynama ani (ISO). */
  tarih: string;
  /** Zaten baglanmissa tekrar baglanmaz. */
  depositId?: string | number | null;
};

export type Yatirim = {
  id: string | number;
  tarih: string;
};

function zaman(deger: unknown): number {
  const t = Date.parse(String(deger ?? ''));
  return Number.isFinite(t) ? t : 0;
}

export type EslesmeSatiri = {
  oynamaId: string;
  username: string;
  /** Eslesen yatirim; bulunamazsa null. */
  depositId: string | null;
  /** Eslesme yapilamama nedeni. */
  neden?: string;
};

export type EslesmeSonucu = {
  satirlar: EslesmeSatiri[];
  /** Zaten depositId tasiyan, dokunulmayan kayit sayisi. */
  atlanan: number;
  /** Eslesen kayit sayisi. */
  eslesen: number;
  /** Oynamadan once yatirimi bulunmayan kayit sayisi. */
  eslesmeyen: number;
  /** Tuketilmis sayilan benzersiz yatirim kimlikleri. */
  tuketilenYatirimlar: string[];
};

/**
 * Gecmis oynamalari yatirimlarla eslestirir.
 *
 * Her oynama, KENDISINDEN ONCEKI en yakin yatirima baglanir. Oynamadan
 * once yatirimi olmayan kayit eslesmez ve engel de olusturmaz —
 * kanitlanamayan bir kullanim yuzunden oyuncuyu engellemek dogru olmaz.
 * (Cark kodu ya da minimum yatirim sartinin olmadigi donem boyle.)
 *
 * Ayni yatirima birden fazla oynama duserse yatirim yine TEK kez
 * tuketilmis sayilir; amac hakkin kapanmasi, sayim degil.
 */
export function gecmisiEslestir(oynamalar: GecmisOynama[], yatirimlar: Yatirim[]): EslesmeSonucu {
  const siraliYatirimlar = (yatirimlar ?? [])
    .map((y) => ({ id: String(y?.id ?? '').trim(), an: zaman(y?.tarih) }))
    .filter((y) => y.id !== '' && y.an > 0)
    .sort((a, b) => a.an - b.an);

  const satirlar: EslesmeSatiri[] = [];
  const tuketilen = new Set<string>();
  let atlanan = 0;
  let eslesen = 0;
  let eslesmeyen = 0;

  for (const oynama of oynamalar ?? []) {
    if (!oynama?.id) continue;

    // Zaten bagli kayda dokunulmaz: islem tekrar calistirilabilir olmali.
    if (String(oynama.depositId ?? '').trim() !== '') {
      atlanan += 1;
      continue;
    }

    const oynamaAni = zaman(oynama.tarih);
    if (!oynamaAni) {
      eslesmeyen += 1;
      satirlar.push({ oynamaId: oynama.id, username: oynama.username, depositId: null, neden: 'Oynama tarihi okunamadı' });
      continue;
    }

    // Oynamadan onceki EN YAKIN yatirim.
    let aday: { id: string; an: number } | null = null;
    for (const y of siraliYatirimlar) {
      if (y.an > oynamaAni) break;
      aday = y;
    }

    if (!aday) {
      eslesmeyen += 1;
      satirlar.push({
        oynamaId: oynama.id,
        username: oynama.username,
        depositId: null,
        neden: 'Oynamadan önce yatırım yok (çark kodu ya da yatırımsız dönem)',
      });
      continue;
    }

    eslesen += 1;
    tuketilen.add(aday.id);
    satirlar.push({ oynamaId: oynama.id, username: oynama.username, depositId: aday.id });
  }

  return {
    satirlar,
    atlanan,
    eslesen,
    eslesmeyen,
    tuketilenYatirimlar: [...tuketilen],
  };
}

/**
 * Lynon kampanya atamasindan oyun odulu mu anlar.
 *
 * chargeBonusToPlayer notu `Narcosbahis oyun odulu: <etiket>` biciminde
 * yaziyor. Kazi kazanin gecmis KAZANAN turlari yalnizca buradan
 * kurtarilabiliyor.
 */
const OYUN_ODULU_ONEKI = /narcosbahis oyun [oö]d[uü]l[uü]/i;

export function oyunOduluMu(assignmentReason: unknown): boolean {
  return OYUN_ODULU_ONEKI.test(String(assignmentReason ?? ''));
}
