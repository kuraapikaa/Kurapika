import { useMemo } from 'react';
import { Package, Plus } from 'lucide-react';
import {
  Alan,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  Izgara,
  IzgaraBaslik,
  IzgaraSatir,
  ModulBasligi,
  Secim,
  SilDugmesi,
  Uyari,
  lira,
} from './oyunUi';

/**
 * KASA YÖNETİMİ.
 *
 * Kasalar ve içlerindeki ödüller. Her kasa için "ortalama ödül" ve
 * "marj" ANLIK hesaplanıp gösteriliyor.
 *
 * ── Neden marj burada ─────────────────────────────────────────────────
 * Bir kasa zararına çalışıyorsa bunun ilk oyuncu binlerce kez açtıktan
 * sonra değil, KAYDEDİLİRKEN görülmesi gerekiyor. Ağırlıkları
 * değiştiren kişi, değişikliğin kasaya maliyetini aynı ekranda görüyor.
 *
 * ── Ağırlık, yüzde değil ──────────────────────────────────────────────
 * Ödüller yüzde değil AĞIRLIK alıyor: yüzdelerin toplamı 100 olmak
 * zorunda kalırdı ve bir ödül eklemek diğerlerinin hepsini elle
 * düzeltmeyi gerektirirdi. Ağırlıkta yalnızca yeni satır ekleniyor.
 * Oyuncuya gösterilen olasılık normalize ediliyor ve burada da
 * SALT OKUNUR gösteriliyor -- elle girilebilseydi ağırlıklarla
 * çelişebilirdi.
 */

const MODUL = 'kazi' as const;

interface KasaOdulu {
  id: string;
  label: string;
  amount: number;
  weight: number;
  rarity?: 'normal' | 'nadir' | 'efsane';
}

interface Kasa {
  id: string;
  label: string;
  price: number;
  enabled?: boolean;
  dailyLimit?: number;
  minDeposit?: number;
  image?: string;
  rewards: KasaOdulu[];
}

interface KasaManagerProps {
  cases: Kasa[];
  onChange: (cases: Kasa[]) => void;
}

const n = (v: unknown) => {
  const s = Number(v);
  return Number.isFinite(s) ? s : 0;
};

/** Ortalama ödül — sunucudaki `beklenenDeger` ile AYNI formül. */
function ortalamaOdul(kasa: Kasa): number {
  const gecerli = (kasa.rewards ?? []).filter((o) => n(o.weight) > 0 && n(o.amount) >= 0);
  const toplam = gecerli.reduce((t, o) => t + n(o.weight), 0);
  if (toplam <= 0) return 0;
  return gecerli.reduce((t, o) => t + n(o.amount) * n(o.weight), 0) / toplam;
}

function yeniKasa(): Kasa {
  const d = Date.now().toString(36);
  return {
    id: `kasa-${d}`,
    label: 'Yeni Kasa',
    price: 500,
    enabled: true,
    dailyLimit: 0,
    minDeposit: 0,
    rewards: [
      { id: `o-${d}-1`, label: 'Boş', amount: 0, weight: 60 },
      { id: `o-${d}-2`, label: '250 ₺', amount: 250, weight: 30 },
      { id: `o-${d}-3`, label: '1.000 ₺', amount: 1000, weight: 10, rarity: 'nadir' },
    ],
  };
}

export function KasaManager({ cases, onChange }: KasaManagerProps) {
  const liste = Array.isArray(cases) ? cases : [];

  const kasaGuncelle = (i: number, yama: Partial<Kasa>) =>
    onChange(liste.map((k, j) => (j === i ? { ...k, ...yama } : k)));

  return (
    <div className="space-y-4">
      <ModulBasligi
        modul={MODUL}
        ikon={<Package size={18} />}
        baslik="Şans Kasaları"
        aciklama="Kasa bedelleri, ödül havuzları ve limitler. Marj negatifse kasa zararına çalışır."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={() => onChange([...liste, yeniKasa()])}>
            <Plus size={14} /> Kasa ekle
          </Dugme>
        }
      />

      {liste.length === 0 && (
        <Bolum baslik="Kasalar" aciklama="Oyuncuların açabilmesi için en az bir kasa ekleyin.">
          <BosDurum
            ikon={<Package size={26} />}
            baslik="Tanımlı kasa yok"
            eylem={<Dugme modul={MODUL} onClick={() => onChange([yeniKasa()])}><Plus size={13} /> İlk kasayı ekle</Dugme>}
          />
        </Bolum>
      )}

      {liste.map((kasa, i) => (
        <KasaKutusu
          key={kasa.id}
          kasa={kasa}
          onKasa={(yama) => kasaGuncelle(i, yama)}
          onOdul={(j, yama) => kasaGuncelle(i, {
            rewards: kasa.rewards.map((o, k) => (k === j ? { ...o, ...yama } : o)),
          })}
          onOdulEkle={() => kasaGuncelle(i, {
            rewards: [...kasa.rewards, { id: `o-${Date.now().toString(36)}`, label: 'Yeni ödül', amount: 0, weight: 10 }],
          })}
          onOdulSil={(j) => kasaGuncelle(i, { rewards: kasa.rewards.filter((_, k) => k !== j) })}
          onSil={() => onChange(liste.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  );
}

function KasaKutusu({ kasa, onKasa, onOdul, onOdulEkle, onOdulSil, onSil }: {
  kasa: Kasa;
  onKasa: (yama: Partial<Kasa>) => void;
  onOdul: (indis: number, yama: Partial<KasaOdulu>) => void;
  onOdulEkle: () => void;
  onOdulSil: (indis: number) => void;
  onSil: () => void;
}) {
  const bd = useMemo(() => ortalamaOdul(kasa), [kasa]);
  const bedel = n(kasa.price);
  const marj = bedel > 0 ? (1 - bd / bedel) * 100 : null;
  const toplamAgirlik = (kasa.rewards ?? []).reduce((t, o) => t + n(o.weight), 0);

  return (
    <Bolum
      baslik={kasa.label || 'İsimsiz kasa'}
      aciklama={`Ortalama ödül ${lira(bd)}${marj != null ? ` · marj %${marj.toFixed(1)}` : ''} · toplam ağırlık ${toplamAgirlik}`}
      eylem={<SilDugmesi onClick={onSil} etiket={`${kasa.label} kasasını sil`} />}
    >
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3 xl:grid-cols-6">
        <Alan etiket="Kasa adı">
          <Girdi modul={MODUL} value={kasa.label} onChange={(e) => onKasa({ label: e.target.value })} />
        </Alan>
        <Alan etiket="Bedel (₺)" ipucu="0 = ücretsiz">
          <Girdi modul={MODUL} sayisal type="number" value={kasa.price} onChange={(e) => onKasa({ price: n(e.target.value) })} />
        </Alan>
        <Alan etiket="Günlük limit" ipucu="0 = sınırsız">
          <Girdi modul={MODUL} sayisal type="number" value={kasa.dailyLimit ?? 0} onChange={(e) => onKasa({ dailyLimit: n(e.target.value) })} />
        </Alan>
        <Alan etiket="Min. son yatırım" ipucu="0 = aranmaz">
          <Girdi modul={MODUL} sayisal type="number" value={kasa.minDeposit ?? 0} onChange={(e) => onKasa({ minDeposit: n(e.target.value) })} />
        </Alan>
        <Alan etiket="Görsel URL" ipucu="Boş: varsayılan simge">
          <Girdi modul={MODUL} value={kasa.image ?? ''} onChange={(e) => onKasa({ image: e.target.value })} />
        </Alan>
        <Alan etiket="Durum">
          <Secim
            modul={MODUL}
            value={kasa.enabled === false ? 'kapali' : 'acik'}
            onChange={(e) => onKasa({ enabled: e.target.value === 'acik' })}
          >
            <option value="acik">Açık</option>
            <option value="kapali">Kapalı</option>
          </Secim>
        </Alan>
      </div>

      {marj != null && marj < 0 && (
        <div className="px-5 pb-4">
          <Uyari tur="hata">
            Bu kasa ZARARINA çalışıyor: ortalama ödül ({lira(bd)}) bedelden ({lira(bedel)}) büyük.
            Ağırlıkları ya da bedeli düzeltin.
          </Uyari>
        </div>
      )}
      {toplamAgirlik <= 0 && (
        <div className="px-5 pb-4"><Uyari tur="dikkat">Hiçbir ödülün ağırlığı yok; bu kasa açılamaz.</Uyari></div>
      )}

      <div className="pb-5">
        <Izgara sutunlar="minmax(140px,1.4fr) 110px 100px 90px 130px 44px">
          <IzgaraBaslik>
            <span>Ödül adı</span><span>Tutar (₺)</span><span>Ağırlık</span>
            <span>Olasılık</span><span>Nadirlik</span><span />
          </IzgaraBaslik>
          {(kasa.rewards ?? []).map((odul, i) => {
            const olasilik = toplamAgirlik > 0 ? (n(odul.weight) / toplamAgirlik) * 100 : 0;
            return (
              <IzgaraSatir key={odul.id ?? i}>
                <Girdi modul={MODUL} value={odul.label} onChange={(e) => onOdul(i, { label: e.target.value })} />
                <Girdi modul={MODUL} sayisal type="number" value={odul.amount} onChange={(e) => onOdul(i, { amount: n(e.target.value) })} />
                <Girdi modul={MODUL} sayisal type="number" value={odul.weight} onChange={(e) => onOdul(i, { weight: n(e.target.value) })} />
                {/* Olasilik HESAPLANAN deger: elle girilemez, yoksa
                    agirliklarla celisirdi. */}
                <span className="text-[13px] font-bold tabular-nums text-amber-300">%{olasilik.toFixed(2)}</span>
                <Secim
                  modul={MODUL}
                  value={odul.rarity ?? 'normal'}
                  onChange={(e) => onOdul(i, { rarity: e.target.value as KasaOdulu['rarity'] })}
                >
                  <option value="normal">Normal</option>
                  <option value="nadir">Nadir</option>
                  <option value="efsane">Efsane</option>
                </Secim>
                <SilDugmesi onClick={() => onOdulSil(i)} etiket={`${odul.label} ödülünü sil`} />
              </IzgaraSatir>
            );
          })}
        </Izgara>
        <div className="mt-3 px-5">
          <Dugme modul={MODUL} onClick={onOdulEkle}><Plus size={13} /> Ödül ekle</Dugme>
        </div>
      </div>
    </Bolum>
  );
}
