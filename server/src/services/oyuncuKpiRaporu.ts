/**
 * Anlik oyuncu KPI sorgu botu — karar ve bicimleme.
 *
 * Istenen: "kullanici id - kullanici adi - telefon numarasi ile sorgu
 * yapilabilsin." Lynon'un kendi arama ucu (`lynonPlayers`) zaten ID,
 * login, e-posta VE telefonu tek bir `query` alaninda araniyor; bu
 * modul yalnizca SONUCU bicimlendiriyor — arama mantigi burada
 * TEKRARLANMAZ.
 */

type AnyRecord = Record<string, any>;

export type OyuncuKpiOzeti = {
  id: string;
  login: string;
  telefon: string | null;
  eposta: string | null;
  kayitTarihi: string | null;
  telefonDogrulandi: boolean | null;
  epostaDogrulandi: boolean | null;
  kimlikDogrulandi: boolean | null;
  kategori: string | null;
  paraBirimi: string;
  gercekBakiye: number | null;
  bonusBakiye: number | null;
  toplamBakiye: number | null;
  toplamYatirim: number | null;
  toplamCekim: number | null;
};

export type OyuncuAday = { id: string; login: string; telefon: string | null };

const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

function para(deger: number | null, kur = 'TRY'): string {
  return deger === null || !Number.isFinite(deger) ? '—' : `${TL.format(deger)} ${kur}`;
}

function onayYaz(deger: boolean | null): string {
  if (deger === null) return '❔';
  return deger ? '✅' : '❌';
}

/** ISO → "03.08.2026 05:12" (Turkiye saati). */
function saatYaz(iso: unknown): string {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(t));
}

/** Bulunan tek oyuncu icin zengin KPI mesaji. */
export function oyuncuKpiMesaji(o: OyuncuKpiOzeti): string {
  const netKarZarar = o.toplamYatirim !== null && o.toplamCekim !== null
    ? o.toplamYatirim - o.toplamCekim
    : null;

  return [
    `🔎✨ OYUNCU KPI · ${o.login} (${o.id})`,
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🪪 HESAP',
    `  Kayıt:    ${saatYaz(o.kayitTarihi)}`,
    `  Telefon:  ${onayYaz(o.telefonDogrulandi)} ${o.telefon ?? '—'}`,
    `  E-posta:  ${onayYaz(o.epostaDogrulandi)} ${o.eposta ?? '—'}`,
    `  Kimlik:   ${onayYaz(o.kimlikDogrulandi)}`,
    `  Kategori: ${o.kategori ?? '—'}`,
    '',
    '💰 BAKİYE',
    `  Gerçek:  ${para(o.gercekBakiye, o.paraBirimi)}`,
    `  Bonus:   ${para(o.bonusBakiye, o.paraBirimi)}`,
    `  Toplam:  ${para(o.toplamBakiye, o.paraBirimi)}`,
    '',
    '📈 YATIRIM / ÇEKİM',
    `  Toplam yatırım: ${para(o.toplamYatirim, o.paraBirimi)}`,
    `  Toplam çekim:   ${para(o.toplamCekim, o.paraBirimi)}`,
    netKarZarar === null
      ? '  Kasaya karşı: —'
      : `  Kasaya karşı: oyuncu ${netKarZarar >= 0 ? '🔴 önde' : '🟢 geride'} ${para(Math.abs(netKarZarar), o.paraBirimi)}`,
  ].join('\n');
}

/** Aramaya birden fazla eslesme donduyse kisa aday listesi. */
export function oyuncuAdaylariMesaji(sorgu: string, adaylar: OyuncuAday[]): string {
  const satirlar = [
    `🔎 "${sorgu}" için birden fazla eşleşme bulundu (${adaylar.length}):`,
    '',
    ...adaylar.slice(0, 8).map((a) => `  • ${a.login} (${a.id})${a.telefon ? ` · ${a.telefon}` : ''}`),
  ];
  if (adaylar.length > 8) satirlar.push(`  • … ${adaylar.length - 8} eşleşme daha`);
  satirlar.push('', 'Kimlik ile tekrar sorgulayın: /oyuncu <id>');
  return satirlar.join('\n');
}

export function oyuncuBulunamadiMesaji(sorgu: string): string {
  return `❌ "${sorgu}" ile eşleşen oyuncu bulunamadı.`;
}
