import { useState } from 'react';
import { AreaChart, BarList, Card, Metric, Text } from '@tremor/react';
import { useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { Button } from '../../components/ui/button';
import { Card as ShadCard, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import type { MusteriYolculuguSonucu as Sonuc } from '@sunucu/sozlesme.js';

/**
 * YOLCULUĞUNUZ — kendi trafiğinizin tıklamadan ilk yatırıma hunisi.
 *
 * Ortak anahtarı YOK burada: uç zaten yalnızca oturumdaki ortağın
 * verisini döndürüyor (bkz. `rotalar/portal.ts`), bu yüzden bir filtre
 * alanı eklemek yalnızca kafa karıştırırdı — seçilecek başka bir şey
 * olmadığı hâlde varmış gibi görünürdü.
 */
export function PortalYolculuk() {
  const [taslak, setTaslak] = useState({ start: '', end: '' });
  const [filtre, setFiltre] = useState({ start: '', end: '' });

  const sorgu = new URLSearchParams();
  if (filtre.start) sorgu.set('start', filtre.start);
  if (filtre.end) sorgu.set('end', filtre.end);
  const yol = `/api/portal/yolculuk${sorgu.toString() ? `?${sorgu}` : ''}`;

  const { veri, yukleniyor, hata } = useVeri<Sonuc>(yol);

  return (
    <>
      <ShadCard>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tarih aralığı</CardTitle>
          <Button size="sm" onClick={() => setFiltre(taslak)}>Uygula</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Başlangıç</span>
              <Input type="date" value={taslak.start} onChange={(e) => setTaslak((t) => ({ ...t, start: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Bitiş</span>
              <Input type="date" value={taslak.end} onChange={(e) => setTaslak((t) => ({ ...t, end: e.target.value }))} />
            </label>
          </div>
        </CardContent>
      </ShadCard>

      {yukleniyor ? (
        <Yukleniyor satir={5} />
      ) : hata ? (
        <HataMesaji mesaj={hata} />
      ) : !veri || (veri.toplam.tiklama === 0 && veri.toplam.kayit === 0) ? (
        <ShadCard>
          <CardContent className="pt-6">
            <BosDurum mesaj="Bu aralıkta tıklama ya da kayıt yok. İlk tıklamadan sonra burası dolmaya başlar." />
          </CardContent>
        </ShadCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <Text>Tıklama</Text>
              <Metric>{veri.toplam.tiklama}</Metric>
              <Text className="mt-1 text-xs">{veri.aralik.start} – {veri.aralik.end}</Text>
            </Card>
            <Card>
              <Text>Kayıt</Text>
              <Metric>{veri.toplam.kayit}</Metric>
              <Text className="mt-1 text-xs">
                {veri.donusum.tiklamaKayit === null ? 'dönüşüm hesaplanamıyor' : `%${veri.donusum.tiklamaKayit} dönüşüm`}
              </Text>
            </Card>
            <Card>
              <Text>İlk yatırım</Text>
              <Metric>{veri.toplam.ilkYatirim === null ? '—' : veri.toplam.ilkYatirim}</Metric>
              <Text className="mt-1 text-xs">
                {veri.toplam.ilkYatirim === null
                  ? 'bu dönemde ölçülemiyor'
                  : veri.donusum.kayitIlkYatirim === null ? '' : `%${veri.donusum.kayitIlkYatirim} dönüşüm`}
              </Text>
            </Card>
            <Card>
              <Text>Aktif oyuncu</Text>
              <Metric>{veri.toplam.aktifOyuncu}</Metric>
              <Text className="mt-1 text-xs">bu aralıkta işlem yapan</Text>
            </Card>
          </div>

          <ShadCard>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Dönüşüm hunisi</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Her satır bir önceki aşamanın ne kadarının ilerlediğini gösterir: kaç tıklamanız
                kayda, kaç kaydınız ilk yatırıma dönüştü.
              </p>
              <BarList
                data={[
                  { name: 'Tıklama', value: veri.toplam.tiklama },
                  {
                    name: veri.donusum.tiklamaKayit === null ? 'Kayıt' : `Kayıt · %${veri.donusum.tiklamaKayit} dönüşüm`,
                    value: veri.toplam.kayit,
                  },
                  ...(veri.toplam.ilkYatirim !== null
                    ? [{
                        name: veri.donusum.kayitIlkYatirim === null
                          ? 'İlk yatırım'
                          : `İlk yatırım · %${veri.donusum.kayitIlkYatirim} dönüşüm`,
                        value: veri.toplam.ilkYatirim,
                      }]
                    : []),
                ]}
                color="amber"
              />
              {veri.toplam.ilkYatirim === null && (
                <p className="mt-3 text-xs text-muted-foreground">
                  İlk yatırım bu dönemde ölçülmüyor; huni yalnızca tıklama ve kayıt aşamalarını gösteriyor.
                </p>
              )}
            </CardContent>
          </ShadCard>

          <div className="grid gap-3 lg:grid-cols-3">
            <ShadCard>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Günlük tıklama</CardTitle></CardHeader>
              <CardContent>
                {veri.gunluk.length === 0 ? (
                  <div className="flex h-44 items-center justify-center"><Text>Ölçüm yok.</Text></div>
                ) : (
                  <AreaChart
                    className="h-44"
                    data={veri.gunluk.map((g) => ({ gun: g.gun.slice(5), Tıklama: g.tiklama }))}
                    index="gun"
                    categories={['Tıklama']}
                    colors={['amber']}
                    showLegend={false}
                  />
                )}
              </CardContent>
            </ShadCard>
            <ShadCard>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Günlük kayıt</CardTitle></CardHeader>
              <CardContent>
                {veri.gunluk.length === 0 ? (
                  <div className="flex h-44 items-center justify-center"><Text>Ölçüm yok.</Text></div>
                ) : (
                  <AreaChart
                    className="h-44"
                    data={veri.gunluk.map((g) => ({ gun: g.gun.slice(5), Kayıt: g.kayit }))}
                    index="gun"
                    categories={['Kayıt']}
                    colors={['amber']}
                    showLegend={false}
                  />
                )}
              </CardContent>
            </ShadCard>
            <ShadCard>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Günlük ilk yatırım</CardTitle></CardHeader>
              <CardContent>
                {veri.gunluk.every((g) => g.ilkYatirim === null) ? (
                  <div className="flex h-44 items-center justify-center"><Text>Bu aralıkta ölçülemiyor.</Text></div>
                ) : (
                  <AreaChart
                    className="h-44"
                    data={veri.gunluk.map((g) => ({ gun: g.gun.slice(5), 'İlk yatırım': g.ilkYatirim ?? 0 }))}
                    index="gun"
                    categories={['İlk yatırım']}
                    colors={['amber']}
                    showLegend={false}
                  />
                )}
              </CardContent>
            </ShadCard>
          </div>

          <ShadCard>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Trafiğiniz nereden geliyor</CardTitle></CardHeader>
            <CardContent>
              {veri.kaynaklar.length === 0 ? (
                <BosDurum mesaj="Bu aralıkta tıklama yok." />
              ) : (
                <BarList
                  data={veri.kaynaklar.map((k) => ({ name: k.kaynak, value: k.tiklama }))}
                  color="amber"
                  valueFormatter={(v: number) => v.toLocaleString('tr-TR')}
                />
              )}
            </CardContent>
          </ShadCard>
        </>
      )}
    </>
  );
}
