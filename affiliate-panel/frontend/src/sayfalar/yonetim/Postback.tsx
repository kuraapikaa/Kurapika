import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { FormSaha } from '../../components/form-saha';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { PostbackAyari as Ayar, PostbackKaydi as Kayit } from '@sunucu/sozlesme.js';

const OLAYLAR = ['tiklama', 'kayit', 'ilk-yatirim', 'yatirim', 'onaylanan-komisyon'];

const BADGE_OLUMLU = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
const BADGE_OLUMSUZ = 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
const BADGE_UYARI = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
const DURUM_SINIFI = { basarili: BADGE_OLUMLU, basarisiz: BADGE_OLUMSUZ, engellendi: BADGE_UYARI } as const;

export function Postback() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ ayarlar: Ayar[]; kayitlar: Kayit[] }>('/api/yonetim/postback');
  const [ortakAnahtari, setOrtakAnahtari] = useState('');
  const [sablon, setSablon] = useState('');
  const [secili, setSecili] = useState<string[]>(['ilk-yatirim']);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  const calistir = async (is: () => Promise<unknown>) => {
    setIslemHatasi(null);
    try {
      await is();
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  if (yukleniyor) return <Yukleniyor satir={5} />;

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Postback ayarı</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Adres yalnızca <strong>https</strong> olabilir ve iç ağa çözümlenen adresler engellenir —
            isteği bizim sunucumuz attığı için kontrol edilmeyen bir adres, iç servislerimize erişim
            kapısı olurdu. Makrolar: <code>{'{clickid}'}</code> <code>{'{payout}'}</code>{' '}
            <code>{'{event}'}</code> <code>{'{btag}'}</code> <code>{'{sub1}'}</code>…
          </p>
          {/* POLİTİKA ÖZETİ — deneme/zaman aşımı gerçek kod sabitlerinden
              (servisler/postback.ts), uydurulmadı. İmza YOK diye ayrıca
              belirtiliyor: gelen webhook (Lynon→biz) HMAC-SHA256 imzalı ama
              giden postback (biz→ortak) imzasız — ikisini karıştırmak
              ortağı yanlış bir güvenlik varsayımına sokardı. */}
          <div className="mb-3 grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground sm:grid-cols-3">
            <div><strong className="text-foreground">Zaman aşımı</strong><br />8 saniye (varsayılan)</div>
            <div><strong className="text-foreground">Deneme</strong><br />En fazla 3 kez, artan bekleme ile</div>
            <div><strong className="text-foreground">İmza</strong><br />Yok — istek düz HTTPS POST'tur</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FormSaha id="pb-ortak" etiket="Ortak anahtarı" deger={ortakAnahtari} degisti={setOrtakAnahtari} />
            <FormSaha
              id="pb-sablon"
              etiket="Şablon"
              deger={sablon}
              degisti={setSablon}
              ipucu="https://tracker.ornek.com/pb?cid={clickid}"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            {OLAYLAR.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={secili.includes(o)}
                  onCheckedChange={(c) => setSecili(c ? [...secili, o] : secili.filter((x) => x !== o))}
                />
                <span>{o}</span>
              </label>
            ))}
          </div>

          <Button
            className="mt-3"
            onClick={() => calistir(async () => {
              await api.yaz('/api/yonetim/postback', { ortakAnahtari, sablon, olaylar: secili, aktif: true });
              setOrtakAnahtari('');
              setSablon('');
            })}
          >
            Kaydet
          </Button>
        </CardContent>
      </Card>

      {(islemHatasi || hata) && <HataMesaji mesaj={islemHatasi ?? hata!} />}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Ayarlar</CardTitle></CardHeader>
        <CardContent>
          {(veri?.ayarlar ?? []).length === 0 ? (
            <BosDurum mesaj="Postback ayarı yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ortak</TableHead>
                  <TableHead>Şablon</TableHead>
                  <TableHead>Olaylar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.ayarlar.map((a) => (
                  <TableRow key={a.ortakAnahtari}>
                    <TableCell><code className="text-xs">{a.ortakAnahtari}</code></TableCell>
                    <TableCell><span className="block max-w-sm truncate text-xs" title={a.sablon}>{a.sablon}</span></TableCell>
                    <TableCell><span className="text-xs">{a.olaylar.join(', ')}</span></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={a.aktif ? BADGE_OLUMLU : undefined}>{a.aktif ? 'Aktif' : 'Pasif'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => calistir(() => api.sil(`/api/yonetim/postback/${encodeURIComponent(a.ortakAnahtari)}`))}
                      >
                        Sil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Son gönderimler</CardTitle></CardHeader>
        <CardContent>
          {(veri?.kayitlar ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz gönderim yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Ortak</TableHead>
                  <TableHead>Olay</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.kayitlar.slice(0, 50).map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-xs">{gunBicimi(k.gonderildi)}</TableCell>
                    <TableCell><code className="text-xs">{k.ortakAnahtari}</code></TableCell>
                    <TableCell>{k.olay}</TableCell>
                    <TableCell><Badge variant="outline" className={DURUM_SINIFI[k.durum]}>{k.durum}</Badge></TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {k.mesaj ?? (k.httpDurum ? `HTTP ${k.httpDurum}` : '—')}
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
