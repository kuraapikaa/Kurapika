import { useEffect, useState } from 'react';
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

export function PortalPostback() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ ayar: Ayar | null; kayitlar: Kayit[] }>('/api/portal/postback');
  const [sablon, setSablon] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    if (veri?.ayar) {
      setSablon(veri.ayar.sablon);
      setSecili(veri.ayar.olaylar);
    }
  }, [veri?.ayar]);

  const kaydet = async () => {
    setIslemHatasi(null);
    setKaydedildi(false);
    try {
      await api.yaz('/api/portal/postback', { sablon, olaylar: secili, aktif: true });
      setKaydedildi(true);
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'Kaydedilemedi.');
    }
  };

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Postback adresiniz</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Bir dönüşüm olduğunda sunucumuz bu adrese istek atar. Yalnızca <strong>https</strong>{' '}
            kabul edilir ve iç ağa çözümlenen adresler reddedilir. Kullanabileceğiniz makrolar:{' '}
            <code>{'{clickid}'}</code> <code>{'{payout}'}</code> <code>{'{event}'}</code>{' '}
            <code>{'{btag}'}</code> <code>{'{sub1}'}</code>…<code>{'{sub5}'}</code>
          </p>

          <FormSaha
            id="ppb-sablon"
            etiket="Şablon"
            deger={sablon}
            degisti={setSablon}
            ipucu="https://tracker.ornek.com/pb?cid={clickid}&payout={payout}"
          />

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

          <div className="mt-3 flex items-center gap-3">
            <Button onClick={kaydet}>Kaydet</Button>
            {kaydedildi && <span className="text-sm text-emerald-600 dark:text-emerald-400">Kaydedildi.</span>}
          </div>

          {islemHatasi && <div className="mt-3"><HataMesaji mesaj={islemHatasi} /></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Gönderim geçmişi</CardTitle></CardHeader>
        <CardContent>
          {(veri?.kayitlar ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz gönderim yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Olay</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.kayitlar.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-xs">{gunBicimi(k.gonderildi)}</TableCell>
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
