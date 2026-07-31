import { useMemo } from 'react';
import { Crown, Film, Link2, Plus, Star, Trophy } from 'lucide-react';
import {
  Alan,
  Anahtar,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  ModulBasligi,
  Olcut,
  OlcutListesi,
  RAKAM,
  SilDugmesi,
  Uyari,
  lira,
  sayi,
} from './oyunUi';

type MillionaireRecord = {
  id: string;
  title: string;
  amount: string;
  player: string;
  game: string;
  imageUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  featured?: boolean;
};

type SocialLink = { id: string; label: string; url: string };

type MillionaireShowcaseConfig = {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  showTicker: boolean;
  showSocial: boolean;
  disclaimer: string;
  socialLinks: SocialLink[];
  records: MillionaireRecord[];
};

const MODUL = 'vitrin' as const;

const VARSAYILAN: MillionaireShowcaseConfig = {
  isActive: true,
  eyebrow: 'Büyük Kazanç Vitrini',
  title: 'Büyük kazanç anları burada parlıyor',
  description: 'Öne çıkan kazanç kayıtlarını, video anlarını ve yüksek ödül hikayelerini lobide tek vitrinde göster.',
  ctaLabel: 'Kazancı izle',
  showTicker: true,
  showSocial: false,
  disclaimer: '18+ Sorumlu oyun. Görseller ve videolar yalnızca izinli içeriklerle kullanılmalıdır.',
  socialLinks: [],
  records: [],
};

const yeniKayit = (): MillionaireRecord => ({
  id: `win-${Date.now()}`,
  title: 'Yeni büyük kazanç',
  amount: '₺100.000',
  player: 'K***',
  game: 'Öne çıkan oyun',
  imageUrl: '',
  posterUrl: '',
  videoUrl: '',
  featured: false,
});

const yeniSosyal = (): SocialLink => ({ id: `social-${Date.now()}`, label: 'Sosyal kanal', url: '' });

const tutarSayisi = (amount: string) => Number(String(amount || '').replace(/[^\d]/g, '')) || 0;

export function MillionaireShowcaseManager({
  config,
  onUpdate,
}: {
  config?: Partial<MillionaireShowcaseConfig>;
  onUpdate: (config: MillionaireShowcaseConfig) => void;
}) {
  const veri: MillionaireShowcaseConfig = {
    ...VARSAYILAN,
    ...(config || {}),
    records: Array.isArray(config?.records) ? config.records : VARSAYILAN.records,
    socialLinks: Array.isArray(config?.socialLinks) ? config.socialLinks : VARSAYILAN.socialLinks,
  };

  const guncelle = (patch: Partial<MillionaireShowcaseConfig>) => onUpdate({ ...veri, ...patch });

  /**
   * Tek one-cikan kurali.
   *
   * Bir kayit one cikarilinca digerlerinin isareti kalkar: vitrinin basinda
   * tek buyuk kart var, iki kayit birden one cikarsa hangisinin gosterilecegi
   * belirsizlesir.
   */
  const kayitGuncelle = (id: string, patch: Partial<MillionaireRecord>) => {
    const records = veri.records.map((kayit) => {
      if (kayit.id !== id) return patch.featured ? { ...kayit, featured: false } : kayit;
      return { ...kayit, ...patch };
    });
    onUpdate({ ...veri, records });
  };

  const sosyalGuncelle = (id: string, patch: Partial<SocialLink>) =>
    guncelle({ socialLinks: veri.socialLinks.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const ozet = useMemo(() => {
    const tutarlar = veri.records.map((r) => tutarSayisi(r.amount));
    return {
      adet: veri.records.length,
      videolu: veri.records.filter((r) => (r.videoUrl || '').trim()).length,
      gorselsiz: veri.records.filter((r) => !(r.imageUrl || '').trim()).length,
      tutarsiz: veri.records.filter((r) => tutarSayisi(r.amount) === 0).length,
      enBuyuk: tutarlar.length ? Math.max(...tutarlar) : 0,
      toplam: tutarlar.reduce((t, v) => t + v, 0),
      oneCikan: veri.records.find((r) => r.featured),
    };
  }, [veri.records]);

  return (
    <div className="space-y-5">
      <ModulBasligi
        modul={MODUL}
        ikon={<Crown size={20} />}
        baslik="Kazanç Vitrini"
        aciklama="Lobide gösterilen büyük kazanç kayıtları ve video anları."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={() => guncelle({ records: [...veri.records, yeniKayit()] })}>
            <Plus size={14} /> Kazanç ekle
          </Dugme>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Bolum baslik="Vitrin metinleri">
            <div className="space-y-4 px-5 py-4">
              <Anahtar
                modul={MODUL}
                acik={veri.isActive !== false}
                onDegis={(isActive) => guncelle({ isActive })}
                etiket="Vitrin yayında"
                aciklama="Kapalıyken lobide kazanç bölümü görünmez."
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Alan etiket="Üst etiket">
                  <Girdi modul={MODUL} value={veri.eyebrow} onChange={(e) => guncelle({ eyebrow: e.target.value })} />
                </Alan>
                <Alan etiket="Buton yazısı">
                  <Girdi modul={MODUL} value={veri.ctaLabel} onChange={(e) => guncelle({ ctaLabel: e.target.value })} />
                </Alan>
                <Alan etiket="Başlık" className="lg:col-span-2">
                  <Girdi modul={MODUL} value={veri.title} onChange={(e) => guncelle({ title: e.target.value })} />
                </Alan>
                <Alan etiket="Açıklama" className="lg:col-span-2">
                  <Girdi modul={MODUL} value={veri.description} onChange={(e) => guncelle({ description: e.target.value })} />
                </Alan>
                <Alan etiket="Yasal uyarı" className="lg:col-span-2" ipucu="Vitrinin altında küçük punto gösterilir.">
                  <Girdi modul={MODUL} value={veri.disclaimer} onChange={(e) => guncelle({ disclaimer: e.target.value })} />
                </Alan>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Anahtar
                  modul={MODUL}
                  acik={veri.showTicker !== false}
                  onDegis={(showTicker) => guncelle({ showTicker })}
                  etiket="Kayan şerit"
                  aciklama="Kazançları yatay akan bantta gösterir."
                />
                <Anahtar
                  modul={MODUL}
                  acik={veri.showSocial === true}
                  onDegis={(showSocial) => guncelle({ showSocial })}
                  etiket="Sosyal bağlantılar"
                  aciklama="Vitrinin altında kanal linkleri."
                />
              </div>
            </div>
          </Bolum>

          <Bolum
            baslik="Kazanç kayıtları"
            aciklama="Öne çıkan kayıt vitrinin başında büyük kartla gösterilir; aynı anda yalnızca biri olabilir."
          >
            {veri.records.length === 0 ? (
              <BosDurum
                ikon={<Trophy size={26} />}
                baslik="Kayıt yok. Vitrin açık olsa bile boş görünür."
                eylem={
                  <Dugme modul={MODUL} tur="birincil" onClick={() => guncelle({ records: [yeniKayit()] })}>
                    <Plus size={14} /> İlk kazancı ekle
                  </Dugme>
                }
              />
            ) : (
              <div className="space-y-3 p-4">
                {veri.records.map((kayit) => (
                  <div
                    key={kayit.id}
                    className="rounded-xl border bg-black/20 p-4"
                    style={{
                      borderColor: kayit.featured ? '#bf5af259' : 'var(--panel-border, rgba(242,244,248,0.1))',
                    }}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`${RAKAM} text-[15px] font-semibold text-[color:var(--panel-text,#f2f4f8)]`}>
                          {kayit.amount || '—'}
                        </span>
                        <span className="truncate text-[11px] font-medium text-[color:var(--panel-muted,#8a919c)]">
                          {kayit.player || 'Oyuncu yok'} · {kayit.game || 'Oyun yok'}
                        </span>
                        {(kayit.videoUrl || '').trim() && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)]">
                            <Film size={11} /> Video
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => kayitGuncelle(kayit.id, { featured: !kayit.featured })}
                          aria-pressed={!!kayit.featured}
                          title={kayit.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition-colors"
                          style={
                            kayit.featured
                              ? { background: '#bf5af21f', color: '#bf5af2' }
                              : { color: 'var(--panel-faint, #5c6470)' }
                          }
                        >
                          <Star size={13} fill={kayit.featured ? 'currentColor' : 'none'} />
                          Öne çıkan
                        </button>
                        <SilDugmesi
                          onClick={() => guncelle({ records: veri.records.filter((r) => r.id !== kayit.id) })}
                          etiket="Kaydı sil"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                      <Alan etiket="Başlık">
                        <Girdi modul={MODUL} value={kayit.title} onChange={(e) => kayitGuncelle(kayit.id, { title: e.target.value })} />
                      </Alan>
                      <Alan etiket="Tutar" ipucu="Serbest metin; lobide yazdığınız gibi görünür.">
                        <Girdi modul={MODUL} value={kayit.amount} onChange={(e) => kayitGuncelle(kayit.id, { amount: e.target.value })} />
                      </Alan>
                      <Alan etiket="Oyuncu" ipucu="Maskeli yazın: K***">
                        <Girdi modul={MODUL} value={kayit.player} onChange={(e) => kayitGuncelle(kayit.id, { player: e.target.value })} />
                      </Alan>
                      <Alan etiket="Oyun">
                        <Girdi modul={MODUL} value={kayit.game} onChange={(e) => kayitGuncelle(kayit.id, { game: e.target.value })} />
                      </Alan>
                      <Alan etiket="Görsel URL" className="xl:col-span-2">
                        <Girdi modul={MODUL} value={kayit.imageUrl || ''} onChange={(e) => kayitGuncelle(kayit.id, { imageUrl: e.target.value })} placeholder="https://..." />
                      </Alan>
                      <Alan etiket="Video URL">
                        <Girdi modul={MODUL} value={kayit.videoUrl || ''} onChange={(e) => kayitGuncelle(kayit.id, { videoUrl: e.target.value })} placeholder="https://..." />
                      </Alan>
                      <Alan etiket="Video kapağı">
                        <Girdi modul={MODUL} value={kayit.posterUrl || ''} onChange={(e) => kayitGuncelle(kayit.id, { posterUrl: e.target.value })} placeholder="https://..." />
                      </Alan>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Bolum>

          {veri.showSocial && (
            <Bolum
              baslik="Sosyal bağlantılar"
              eylem={
                <Dugme modul={MODUL} onClick={() => guncelle({ socialLinks: [...veri.socialLinks, yeniSosyal()] })}>
                  <Plus size={14} /> Bağlantı ekle
                </Dugme>
              }
            >
              {veri.socialLinks.length === 0 ? (
                <BosDurum ikon={<Link2 size={26} />} baslik="Sosyal bağlantı açık ama liste boş." />
              ) : (
                <div className="space-y-3 p-4">
                  {veri.socialLinks.map((link) => (
                    <div key={link.id} className="flex items-end gap-3">
                      <Alan etiket="Etiket" className="w-48 shrink-0">
                        <Girdi modul={MODUL} value={link.label} onChange={(e) => sosyalGuncelle(link.id, { label: e.target.value })} />
                      </Alan>
                      <Alan etiket="Adres" className="min-w-0 flex-1">
                        <Girdi modul={MODUL} value={link.url} onChange={(e) => sosyalGuncelle(link.id, { url: e.target.value })} placeholder="https://..." />
                      </Alan>
                      <SilDugmesi
                        onClick={() => guncelle({ socialLinks: veri.socialLinks.filter((s) => s.id !== link.id) })}
                        etiket="Bağlantıyı sil"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Bolum>
          )}
        </div>

        <aside className="space-y-5">
          <Bolum baslik="Vitrin özeti">
            <OlcutListesi>
              <Olcut etiket="Kayıt" deger={sayi(ozet.adet)} vurgulu />
              <Olcut etiket="Videolu" deger={sayi(ozet.videolu)} />
              <Olcut etiket="En büyük kazanç" deger={lira(ozet.enBuyuk)} vurgulu />
              <Olcut etiket="Vitrindeki toplam" deger={lira(ozet.toplam)} />
            </OlcutListesi>
            <p className="border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 py-3 text-[11px] font-medium text-[color:var(--panel-muted,#8a919c)]">
              {ozet.oneCikan
                ? `Öne çıkan: ${ozet.oneCikan.title || ozet.oneCikan.amount}`
                : 'Öne çıkan kayıt seçilmedi; vitrin ilk kaydı kullanır.'}
            </p>
          </Bolum>

          {ozet.gorselsiz > 0 && (
            <Uyari tur="dikkat">
              {ozet.gorselsiz} kaydın görseli yok. Bu kartlar lobide boş çerçeveyle çıkar.
            </Uyari>
          )}
          {ozet.tutarsiz > 0 && (
            <Uyari tur="dikkat">
              {ozet.tutarsiz} kaydın tutarı okunamıyor. Sıralama ve toplamlarda 0 sayılır.
            </Uyari>
          )}
          {veri.isActive !== false && ozet.adet === 0 && (
            <Uyari tur="hata">Vitrin açık ama kayıt yok; lobide boş bölüm görünür.</Uyari>
          )}

          <Bolum baslik="İçerik kuralı">
            <ul className="space-y-2.5 px-5 py-4 text-[11px] font-medium leading-relaxed text-[color:var(--panel-muted,#8a919c)]">
              <li>Oyuncu adları maskeli yazılmalı; tam kullanıcı adı yayınlamayın.</li>
              <li>Görsel ve videolar yalnızca izin alınmış içeriklerden kullanılmalı.</li>
              <li>Aynı anda tek kayıt öne çıkabilir; yenisini seçince eskisi normale döner.</li>
            </ul>
          </Bolum>
        </aside>
      </div>
    </div>
  );
}
