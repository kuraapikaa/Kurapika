import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { Alan, Bos, Buton, Hata, Kart, Yukleniyor } from '../../ui';
import type { YonetimUclari } from '@sunucu/sozlesme.js';

/**
 * LYNON WEBHOOK SIRRI.
 *
 * Bu sayfa olmadan panel geçmişe dönük çekme (`Backoffice'ten çek`) ve
 * eşleşme dışında hiçbir yatırım/çekim/GGR rakamı ALAMAZ: gün içi
 * rakamlar (`oyuncu_gunluk` → ortak özeti) yalnızca bu webhook'tan
 * gelen olaylarla besleniyor (bkz. `isler/olayIsleyici.ts`). Sunucu
 * tarafı hazır ama şimdiye kadar sırrı üretecek bir ekran yoktu.
 */
export function Webhook() {
  const { veri, yukleniyor, hata, yenile } = useVeri<YonetimUclari['/webhook-durumu']>('/api/yonetim/webhook-durumu');
  const [elleSir, setElleSir] = useState('');
  const [uretilenSir, setUretilenSir] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [isliyor, setIsliyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  const calistir = async (is: () => Promise<unknown>) => {
    setIsliyor(true);
    setIslemHatasi(null);
    try {
      await is();
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setIsliyor(false);
    }
  };

  const uret = () => calistir(async () => {
    const yanit = await api.gonder<{ uretildi: boolean; sir?: string }>('/api/yonetim/webhook-sirri', {});
    if (yanit.uretildi && yanit.sir) {
      setUretilenSir(yanit.sir);
      // Yeni sir uretildiginde kopyalama durumu sifirlaniyor: onceki
      // "Kopyalandi" etiketi yeni sir icin YANLIS bir guvence olurdu.
      setKopyalandi(false);
    }
  });

  const elleKaydet = () => calistir(async () => {
    await api.gonder('/api/yonetim/webhook-sirri', { sir: elleSir });
    setElleSir('');
  });

  const sil = () => calistir(async () => {
    await api.sil('/api/yonetim/webhook-sirri');
    setUretilenSir(null);
  });

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const sir = veri?.sir;
  const kuyruk = veri?.kuyruk;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti
          etiket="Webhook sırrı"
          deger={sir?.kuruluMu ? 'Kurulu' : 'Yok'}
          alt={sir?.guncellendi ? `son: ${gunBicimi(sir.guncellendi)}` : 'hiç kurulmadı'}
        />
        <OlcuKarti etiket="Bekleyen olay" deger={String(kuyruk?.bekleyen ?? 0)} />
        <OlcuKarti etiket="İşlenen olay" deger={String(kuyruk?.tamam ?? 0)} />
        <OlcuKarti
          etiket="Hatalı olay"
          deger={String(kuyruk?.hatali ?? 0)}
          alt={(kuyruk?.hatali ?? 0) > 0 ? 'imza ya da biçim reddi' : undefined}
        />
      </div>

      <Kart baslik="Lynon webhook bağlantısı">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Yatırım, çekim, bahis ve kazanç olayları buradan gelir. Bu olay hiç akmıyorsa gün içi
          GGR de akmaz — geçmişe dönük "Backoffice'ten çek" ve "Geçmiş GGR'yi doldur" ayrı bir
          yoldan çalışır, bu ikisini etkilemez. Aşağıdaki sırrı üretin ve Lynon tarafında bu ucu
          + sırrı webhook ayarına girin:
        </p>

        {/* `--metin-1` diye bir değişken YOK (palette `--metin` ve
            `--metin-2` var). Geçersiz değer sessizce yok sayılıp renk miras
            alınıyordu; kod bloğunun okunurluğu tesadüfe kalmıştı. */}
        <pre
          className="overflow-x-auto rounded-lg p-3 text-xs"
          style={{ background: 'var(--yuzey-2)', color: 'var(--metin)' }}
        >{`POST /api/webhooks/lynon
x-lynon-zaman: <unix-saniye>
x-lynon-imza: sha256=<hmac-sha256("{zaman}.{govde}", sir)>
Content-Type: application/json

{ "eventType": "deposit" | "withdrawal" | "bet" | "win", "playerId": "123456", "amount": 100 }`}</pre>

        <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
          İmza HAM gövde metninden hesaplanıyor; JSON'u çözüp yeniden dizmeyin. Zaman damgası 5
          dakikadan eskiyse istek reddedilir — tekrar saldırısına karşı.
        </p>

        {(islemHatasi) && <div className="mt-3"><Hata mesaj={islemHatasi} /></div>}

        {uretilenSir && (
          <div
            className="mt-3 rounded-lg p-3"
            style={{ background: 'var(--yuzey-2)', border: '1px solid var(--uyari)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--uyari)' }}>
              Bu değer bir daha gösterilmeyecek — şimdi kopyalayıp Lynon tarafına girin.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs">{uretilenSir}</code>
              {/* Elle seçip kopyalamak, bir daha gösterilmeyecek bir değerde
                  en riskli adım: eksik seçilen bir sır Lynon tarafında
                  "imza geçersiz" olarak döner ve sebebi görünmez. */}
              <Buton
                onClick={() => {
                  navigator.clipboard.writeText(uretilenSir)
                    .then(() => setKopyalandi(true))
                    .catch(() => setKopyalandi(false));
                }}
              >
                {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
              </Buton>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Buton tur="birincil" onClick={uret} devredisi={isliyor}>
            {sir?.kuruluMu ? 'Yeni sır üret (eskisi geçersiz olur)' : 'Sır üret'}
          </Buton>
          {sir?.kuruluMu && (
            <Buton tur="tehlike" onClick={sil} devredisi={isliyor}>Sırrı kaldır</Buton>
          )}
        </div>

        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--kenar)' }}>
          <p className="mb-2 text-xs" style={{ color: 'var(--metin-2)' }}>
            Lynon size sırrı SİZİN belirlemenizi istiyorsa, üretmek yerine buraya elle girin:
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Alan etiket="Sır (en az 16 karakter)" deger={elleSir} degisti={setElleSir} tip="password" />
            <Buton onClick={elleKaydet} devredisi={isliyor || elleSir.trim().length < 16}>Kaydet</Buton>
          </div>
        </div>

        {sir?.maskeli && (
          <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
            Kurulu sır: <code>{sir.maskeli}</code>
          </p>
        )}
      </Kart>

      {veri?.veritabaniVarMi === false && (
        <Kart baslik="Kalıcı depolama yok">
          <Bos mesaj="Bu ortamda veritabanı bağlı değil; webhook olayları kabul edilse bile kalıcı olarak saklanmaz." />
        </Kart>
      )}
    </>
  );
}
