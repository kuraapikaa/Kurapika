import { useMemo } from 'react';
import { Plus, Ticket } from 'lucide-react';
import {
  Alan,
  AlanIcinde,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  Izgara,
  IzgaraBaslik,
  IzgaraSatir,
  MaliyetKarti,
  ModulBasligi,
  Olcut,
  OlcutListesi,
  PaySeridi,
  RAKAM,
  Secim,
  SilDugmesi,
  Uyari,
  beklenenMaliyet,
  lira,
  sayi,
} from './oyunUi';
import { LynonAssignmentValuesField } from './LynonAssignmentValuesField';

interface ScratchReward {
  id: string | number;
  label: string;
  probability: number;
  type: 'bonus' | 'none';
  bonusId: string | null;
  amount: number;
  assignmentValues?: Record<string, unknown>;
}

interface ScratchManagerProps {
  config: {
    baseWinProbability: number;
    minInvestment?: number;
    rewards: ScratchReward[];
  };
  bonusOptions: any[];
  onUpdate: (newConfig: any) => void;
}

const MODUL = 'kazi' as const;
const SUTUNLAR = 'minmax(0,2fr) 110px 110px minmax(150px,1fr) 44px';

export function ScratchManager({ config, bonusOptions, onUpdate }: ScratchManagerProps) {
  const oduller = config.rewards ?? [];

  const ozet = useMemo(() => {
    const parcalar = oduller.map((r) => ({ agirlik: Number(r.probability) || 0, tutar: Number(r.amount) || 0 }));
    const toplamAgirlik = parcalar.reduce((t, p) => t + p.agirlik, 0);
    return {
      toplamAgirlik,
      adet: oduller.length,
      maliyet: beklenenMaliyet(parcalar, config.baseWinProbability),
      enBuyuk: oduller.reduce((enB, r) => Math.max(enB, Number(r.amount) || 0), 0),
      agirliksiz: oduller.filter((r) => !(Number(r.probability) > 0)).length,
    };
  }, [oduller, config.baseWinProbability]);

  const odulEkle = () => {
    onUpdate({
      ...config,
      rewards: [
        ...oduller,
        { id: Date.now(), label: 'Yeni ödül', probability: 10, type: 'bonus', bonusId: null, amount: 10 },
      ],
    });
  };

  const odulSil = (id: string | number) => {
    onUpdate({ ...config, rewards: oduller.filter((r) => r.id !== id) });
  };

  const odulGuncelle = (id: string | number, values: Partial<ScratchReward>) => {
    onUpdate({ ...config, rewards: oduller.map((r) => (r.id === id ? { ...r, ...values } : r)) });
  };

  const bonuslu = oduller.filter((r) => r.type === 'bonus' && r.bonusId);

  return (
    <div className="space-y-5">
      <ModulBasligi
        modul={MODUL}
        ikon={<Ticket size={20} />}
        baslik="Kazı Kazan"
        aciklama="Kazanma oranı, ödül havuzu ve ağırlıklar."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={odulEkle}>
            <Plus size={14} /> Ödül ekle
          </Dugme>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Bolum baslik="Oyun kuralları" aciklama="Her oyunda bu oranla ödül çekilişi yapılır.">
            <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
              <Alan etiket="Kazanma oranı" ipucu="Kalan oyunlar boş çıkar; havuza boş ödül eklemeye gerek yok.">
                <AlanIcinde ek="%">
                  <Girdi
                    modul={MODUL}
                    sayisal
                    type="number"
                    min={0}
                    max={100}
                    value={config.baseWinProbability}
                    onChange={(e) => onUpdate({ ...config, baseWinProbability: Number(e.target.value) })}
                  />
                </AlanIcinde>
              </Alan>
              <Alan etiket="Yatırım şartı" ipucu="Oynamak için gereken son yatırım tutarı. 0 = şartsız.">
                <AlanIcinde ek="TL">
                  <Girdi
                    modul={MODUL}
                    sayisal
                    type="number"
                    min={0}
                    value={config.minInvestment ?? 0}
                    onChange={(e) => onUpdate({ ...config, minInvestment: Number(e.target.value) })}
                  />
                </AlanIcinde>
              </Alan>
            </div>
          </Bolum>

          <Bolum
            baslik="Ödül havuzu"
            aciklama="Ağırlık mutlak oran değil; ödülün havuz içindeki payını belirler."
          >
            {oduller.length === 0 ? (
              <BosDurum
                ikon={<Ticket size={26} />}
                baslik="Havuz boş. Ödül eklemeden oyun kazanç veremez."
                eylem={
                  <Dugme modul={MODUL} tur="birincil" onClick={odulEkle}>
                    <Plus size={14} /> İlk ödülü ekle
                  </Dugme>
                }
              />
            ) : (
              <>
                <Izgara sutunlar={SUTUNLAR}>
                  <IzgaraBaslik>
                    <span>Etiket</span>
                    <span>Tutar</span>
                    <span>Ağırlık</span>
                    <span>Bonus</span>
                    <span />
                  </IzgaraBaslik>
                  {oduller.map((odul, idx) => (
                    <IzgaraSatir key={odul.id || idx}>
                      <Girdi
                        modul={MODUL}
                        className="h-9"
                        value={odul.label}
                        onChange={(e) => odulGuncelle(odul.id, { label: e.target.value })}
                        placeholder="Ödül adı"
                        aria-label="Ödül adı"
                      />
                      <Girdi
                        modul={MODUL}
                        sayisal
                        className="h-9"
                        type="number"
                        min={0}
                        value={odul.amount}
                        onChange={(e) => odulGuncelle(odul.id, { amount: Number(e.target.value) })}
                        aria-label="Ödül tutarı"
                      />
                      <Girdi
                        modul={MODUL}
                        sayisal
                        className="h-9"
                        type="number"
                        min={0}
                        value={odul.probability}
                        onChange={(e) => odulGuncelle(odul.id, { probability: Number(e.target.value) })}
                        aria-label="Ödül ağırlığı"
                      />
                      <Secim
                        modul={MODUL}
                        className="h-9 text-[11px]"
                        value={odul.bonusId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const opt = bonusOptions.find((o) => o.id === val);
                          odulGuncelle(odul.id, { bonusId: val || null, label: opt ? opt.value : odul.label });
                        }}
                        aria-label="Bağlı bonus"
                      >
                        <option value="">Manuel</option>
                        {bonusOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.display}</option>
                        ))}
                      </Secim>
                      <SilDugmesi onClick={() => odulSil(odul.id)} etiket={`${odul.label} ödülünü sil`} />
                    </IzgaraSatir>
                  ))}
                </Izgara>
                <div className="border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                  <PaySeridi
                    modul={MODUL}
                    parcalar={oduller.map((r) => ({
                      id: r.id,
                      etiket: r.label || 'Adsız',
                      agirlik: Number(r.probability) || 0,
                    }))}
                  />
                </div>
              </>
            )}
          </Bolum>

          {bonuslu.length > 0 && (
            <Bolum baslik="Lynon parametreleri" aciklama="Bonusa bağlı ödüller için atama değerleri.">
              <div className="grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-2">
                {bonuslu.map((odul) => (
                  <LynonAssignmentValuesField
                    key={`assignment-${odul.id}`}
                    label={`${odul.label || `Ödül #${odul.id}`}`}
                    values={odul.assignmentValues}
                    onChange={(assignmentValues) => odulGuncelle(odul.id, { assignmentValues })}
                  />
                ))}
              </div>
            </Bolum>
          )}
        </div>

        <aside className="space-y-5">
          <MaliyetKarti
            modul={MODUL}
            tutar={ozet.maliyet}
            altBaslik={`%${sayi(config.baseWinProbability)} kazanma oranı ve mevcut ağırlıklara göre.`}
          />

          <Bolum baslik="Havuz özeti">
            <OlcutListesi>
              <Olcut etiket="Ödül çeşidi" deger={sayi(ozet.adet)} vurgulu />
              <Olcut etiket="Toplam ağırlık" deger={sayi(ozet.toplamAgirlik)} />
              <Olcut etiket="En büyük ödül" deger={lira(ozet.enBuyuk)} />
              <Olcut
                etiket="Oyun başına ortalama"
                deger={lira(ozet.maliyet / 100)}
              />
            </OlcutListesi>
          </Bolum>

          {ozet.agirliksiz > 0 && (
            <Uyari tur="dikkat">
              {ozet.agirliksiz} ödülün ağırlığı 0. Bu ödüller hiç çıkmaz.
            </Uyari>
          )}
          {oduller.length > 0 && ozet.toplamAgirlik === 0 && (
            <Uyari tur="hata">
              Toplam ağırlık 0. Kazanan oyunlarda ödül seçilemez; en az bir ödüle ağırlık verin.
            </Uyari>
          )}
          {config.baseWinProbability > 0 && oduller.length === 0 && (
            <Uyari tur="hata">
              Kazanma oranı %{sayi(config.baseWinProbability)} ama havuzda ödül yok.
            </Uyari>
          )}

          <Bolum baslik="Nasıl çalışır">
            <ul className="space-y-2.5 px-5 py-4 text-[11px] font-medium leading-relaxed text-[color:var(--panel-muted,#8a919c)]">
              <li>
                Önce kazanma oranı çekilir. Kaybeden oyunlarda havuza hiç bakılmaz.
              </li>
              <li>
                Kazanan oyunda ödül, ağırlıkların <span className={RAKAM}>payına</span> göre seçilir.
                Ağırlık 20 olan bir ödül, ağırlık 10 olanın iki katı sıklıkta çıkar.
              </li>
              <li>
                Bonus seçilen ödüller oyuncu hesabına otomatik yüklenir. Manuel ödüller
                yalnızca kayıt oluşturur.
              </li>
            </ul>
          </Bolum>
        </aside>
      </div>
    </div>
  );
}
