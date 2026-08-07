import { useState } from 'react';
import { api } from '../api';
import { Alan, Buton, Hata, Kart, useTema } from '../ui';

/**
 * GİRİŞ VE BAŞVURU.
 *
 * Üç sekme: yönetici, ortak, başvuru. Ortak ve yönetici girişleri ayrı
 * uçlara gidiyor — tek bir uçta birleştirip rolü sunucunun tahmin
 * etmesi, aynı e-postanın iki tarafta da bulunması durumunda hangi
 * rolün kazandığını belirsiz bırakırdı.
 */

type Sekme = 'yonetici' | 'ortak' | 'basvuru';

export function Giris({ girisYapildi }: { girisYapildi: () => void }) {
  const [sekme, setSekme] = useState<Sekme>('yonetici');
  const [koyu, temaDegistir] = useTema();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [kullanici, setKullanici] = useState('');
  const [parola, setParola] = useState('');
  const [eposta, setEposta] = useState('');
  const [ad, setAd] = useState('');
  const [ortakAnahtari, setOrtakAnahtari] = useState('');
  const [trafikKaynagi, setTrafikKaynagi] = useState('');

  const gonder = async (event: React.FormEvent) => {
    event.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      if (sekme === 'yonetici') {
        await api.gonder('/api/oturum/yonetici', { kullanici, parola });
        girisYapildi();
      } else if (sekme === 'ortak') {
        await api.gonder('/api/oturum/ortak', { eposta, parola });
        girisYapildi();
      } else {
        await api.gonder('/api/oturum/basvuru', { ad, eposta, parola, ortakAnahtari, trafikKaynagi });
        setBilgi('Başvurunuz alındı. Onaylandıktan sonra izleme linki üretebileceksiniz.');
        setSekme('ortak');
      }
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'Bilinmeyen hata.');
    } finally {
      setGonderiliyor(false);
    }
  };

  const sekmeler: Array<{ id: Sekme; etiket: string }> = [
    { id: 'yonetici', etiket: 'Yönetici' },
    { id: 'ortak', etiket: 'Ortak' },
    { id: 'basvuru', etiket: 'Başvuru' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Affiliate Paneli</h1>
          <Buton onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Buton>
        </div>

        <Kart>
          <div className="mb-4 flex gap-1">
            {sekmeler.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSekme(s.id); setHata(null); }}
                className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                style={{
                  background: sekme === s.id ? 'var(--vurgu)' : 'var(--yuzey-2)',
                  color: sekme === s.id ? 'var(--vurgu-metin)' : 'var(--metin-2)',
                }}
              >
                {s.etiket}
              </button>
            ))}
          </div>

          <form className="space-y-3" onSubmit={gonder}>
            {sekme === 'yonetici' && (
              <Alan etiket="Kullanıcı adı" deger={kullanici} degisti={setKullanici} />
            )}
            {sekme === 'basvuru' && (
              <>
                <Alan etiket="Ad / Şirket" deger={ad} degisti={setAd} />
                <Alan
                  etiket="İstediğiniz izleme anahtarı"
                  deger={ortakAnahtari}
                  degisti={setOrtakAnahtari}
                  ipucu="Harf, rakam, nokta, alt çizgi ve tire. Trafiğiniz bu anahtarla eşleşir."
                />
                <Alan etiket="Trafik kaynağı" deger={trafikKaynagi} degisti={setTrafikKaynagi} ipucu="Site adresi, kanal, uygulama…" />
              </>
            )}
            {sekme !== 'yonetici' && (
              <Alan etiket="E-posta" deger={eposta} degisti={setEposta} tip="email" />
            )}
            <Alan
              etiket="Parola"
              deger={parola}
              degisti={setParola}
              tip="password"
              ipucu={sekme === 'basvuru' ? 'En az 10 karakter.' : undefined}
            />

            {hata && <Hata mesaj={hata} />}
            {bilgi && (
              <p className="rounded-lg border px-3 py-2 text-sm" style={{ color: 'var(--olumlu)', borderColor: 'var(--olumlu)' }}>
                {bilgi}
              </p>
            )}

            <Buton tip="submit" tur="birincil" tam devredisi={gonderiliyor}>
              {sekme === 'basvuru' ? 'Başvur' : 'Giriş yap'}
            </Buton>
          </form>
        </Kart>
      </div>
    </div>
  );
}
