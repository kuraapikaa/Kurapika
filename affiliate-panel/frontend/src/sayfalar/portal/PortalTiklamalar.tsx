import { gunBicimi, useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { Tiklama, TiklamaOzeti as Ozet } from '@sunucu/sozlesme.js';

export function PortalTiklamalar() {
  const { veri, yukleniyor, hata } = useVeri<{ ozet: Ozet | null; tiklamalar: Tiklama[] }>('/api/portal/tiklamalar');

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  const ozet = veri?.ozet;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tıklama</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{ozet?.toplam ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">son 30 gün</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Kullanılan kreatif</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{ozet?.medyaBazinda.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Alt kanal</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{ozet?.altBazinda.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {ozet && ozet.altBazinda.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Alt kanal kırılımı</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alan</TableHead>
                  <TableHead>Değer</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ozet.altBazinda.map((a) => (
                  <TableRow key={`${a.anahtar}|${a.deger}`}>
                    <TableCell>{a.anahtar}</TableCell>
                    <TableCell>{a.deger}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.sayi}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Son tıklamalar</CardTitle></CardHeader>
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
