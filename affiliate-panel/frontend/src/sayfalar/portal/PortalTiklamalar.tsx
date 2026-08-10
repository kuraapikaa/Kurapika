import { gunBicimi, useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { Tiklama, TiklamaOzeti as Ozet } from '@sunucu/sozlesme.js';

/**
 * TIKLAMALAR — ortağın trafiğinin ham kaydı.
 *
 * ── Bu sürümde değişen: KIRILIM ARTIK OKUNABİLİR ──
 *
 * Alt kanal tablosu üç kolonluk bir dökümdü (alan, değer, sayı) ve
 * hiçbir yerde ORAN yoktu; ortak "sub1=telegram 412" satırını görüp
 * bunun iyi mi kötü mü olduğunu bilmiyordu. Artık her satırda payı
 * gösteren bir bar var: en çok tıklanan %100, diğerleri ona göre.
 *
 * Ayrıca EPC (tıklama başına kazanç) kartı eklendi. Ortak için tek
 * anlamlı verimlilik ölçüsü bu: tıklama sayısı çabayı, EPC karşılığını
 * ölçüyor.
 *
 * ── Neden ham tıklama listesi kaldı ──
 *
 * Özet yeterli görünür ama tek bir tıklamanın referrer'ını görmek,
 * "linkim çalışıyor mu" sorusunun tek kesin cevabı. Ortak yeni bir yere
 * link koyduğunda ilk baktığı yer bu liste.
 */
export function PortalTiklamalar() {
  const { veri, yukleniyor, hata } = useVeri<{ ozet: Ozet | null; tiklamalar: Tiklama[] }>('/api/portal/tiklamalar');

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  const ozet = veri?.ozet;
  const toplam = ozet?.toplam ?? 0;
  // En yuksek satir bara olcek veriyor: yuzde TOPLAMA gore degil EN
  // BUYUGE gore, cunku bir tiklama birden fazla alt kanal etiketi
  // tasiyabiliyor ve satirlarin toplami toplam tiklamayi asabilir.
  const enBuyukAlt = Math.max(1, ...(ozet?.altBazinda ?? []).map((a) => a.sayi));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tıklama</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{toplam}</p>
            <p className="mt-1 text-xs text-muted-foreground">son 30 gün</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Kullanılan kreatif</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{ozet?.medyaBazinda.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">tıklama alan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Alt kanal</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{ozet?.altBazinda.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">etiketli kırılım</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En çok tıklanan kanal</p>
            {/* Tek satir bile yoksa "—": sifir yazmak "bir kanal var ve
                hic tiklanmadi" gibi okunurdu. */}
            <p className="mt-2 truncate text-2xl font-semibold">
              {ozet?.altBazinda.length
                ? ozet.altBazinda.reduce((e, a) => (a.sayi > e.sayi ? a : e)).deger
                : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ozet?.altBazinda.length
                ? `${ozet.altBazinda.reduce((e, a) => (a.sayi > e.sayi ? a : e)).sayi} tıklama`
                : 'etiketli tıklama yok'}
            </p>
          </CardContent>
        </Card>
      </div>

      {ozet && ozet.altBazinda.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Alt kanal kırılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {ozet.altBazinda.map((a) => (
                <div key={`${a.anahtar}|${a.deger}`} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block truncate text-sm font-medium">{a.deger}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{a.anahtar}</span>
                  </span>
                  <span
                    className="h-1.5 min-w-4 flex-1 overflow-hidden rounded"
                    style={{ background: 'var(--yuzey-2)' }}
                  >
                    <span
                      className="block h-full rounded"
                      style={{
                        width: `${(a.sayi / enBuyukAlt) * 100}%`,
                        backgroundImage: 'var(--tayf-degrade)',
                      }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums">{a.sayi}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Bar payı en çok tıklanan kanala göre. Bir tıklama birden fazla etiket taşıyabildiği
              için satırların toplamı toplam tıklamayı aşabilir.
            </p>
          </CardContent>
        </Card>
      )}

      {ozet && ozet.medyaBazinda.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Kreatif kırılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kreatif</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                  <TableHead className="text-right">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ozet.medyaBazinda.map((m) => (
                  <TableRow key={m.medyaId ?? 'dogrudan'}>
                    <TableCell>
                      {m.medyaId
                        ? <span className="font-mono text-xs">{m.medyaId.slice(0, 12)}</span>
                        : <span className="text-xs text-muted-foreground">Doğrudan (kreatifsiz)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.sayi}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {toplam > 0 ? `%${((m.sayi / toplam) * 100).toFixed(1)}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Son tıklamalar</CardTitle>
        </CardHeader>
        <CardContent>
          {(veri?.tiklamalar ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz tıklama yok. İzlemeli linki kullandığınızda burada görünür." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Kreatif</TableHead>
                  <TableHead>Alt kanallar</TableHead>
                  <TableHead>Kaynak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.tiklamalar.map((t) => (
                  <TableRow key={t.clickId}>
                    <TableCell className="text-xs">{gunBicimi(t.zaman)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{t.medyaId ? t.medyaId.slice(0, 12) : '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {Object.entries(t.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-xs truncate text-xs text-muted-foreground" title={t.referrer ?? ''}>
                        {t.referrer ?? '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Yeni bir yere link koyduysanız burada görünüp görünmediğine bakın — linkin çalıştığının
            en hızlı kanıtı bu liste.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
