import { gunBicimi, useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { Tiklama, TiklamaOzeti as Ozet } from '@sunucu/sozlesme.js';

export function Tiklamalar() {
  const { veri, yukleniyor, hata } = useVeri<{ ozet: Ozet[]; tiklamalar: Tiklama[] }>('/api/yonetim/tiklamalar');

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Ortak bazında tıklama</CardTitle></CardHeader>
        <CardContent>
          {(veri?.ozet ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz tıklama yok. Ortaklar izlemeli linki kullandığında burada görünür." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ortak</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                  <TableHead>Kreatif kırılımı</TableHead>
                  <TableHead>Alt kanal kırılımı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.ozet.map((o) => (
                  <TableRow key={o.ortakAnahtari}>
                    <TableCell><code className="text-xs">{o.ortakAnahtari}</code></TableCell>
                    <TableCell className="text-right tabular-nums">{o.toplam}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {o.medyaBazinda.slice(0, 3).map((m) => `${m.medyaId ?? 'doğrudan'}: ${m.sayi}`).join(' · ') || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {o.altBazinda.slice(0, 3).map((a) => `${a.anahtar}=${a.deger}: ${a.sayi}`).join(' · ') || '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Son tıklamalar</CardTitle></CardHeader>
        <CardContent>
          {(veri?.tiklamalar ?? []).length === 0 ? (
            <BosDurum mesaj="Kayıt yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Ortak</TableHead>
                  <TableHead>Medya</TableHead>
                  <TableHead>Alt kanallar</TableHead>
                  <TableHead>Kaynak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.tiklamalar.slice(0, 100).map((t) => (
                  <TableRow key={t.clickId}>
                    <TableCell className="text-xs">{gunBicimi(t.zaman)}</TableCell>
                    <TableCell><code className="text-xs">{t.ortakAnahtari}</code></TableCell>
                    <TableCell><span className="text-xs">{t.medyaId ?? '—'}</span></TableCell>
                    <TableCell>
                      <span className="text-xs">{Object.entries(t.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}</span>
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
        </CardContent>
      </Card>
    </>
  );
}
