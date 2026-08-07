import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Link2, Plus, Trash2, Video, X } from 'lucide-react';
import { affiliateAdminApi, type Medya, type MedyaGirdisi, type MedyaTuru } from '../../../api/client';
import { formatDateDisplay } from '../../../lib/format';
import { Alan, BosDurum, BUTON_ANA, BUTON_SESSIZ, ETIKET, GIRDI, HataSatiri, KART, Rozet } from './ortakUi';

/**
 * Medya yönetimi.
 *
 * Ortağa verilen kreatifler ve her birinin izleme linki. Kimlik linke
 * gömüldüğü için "hangi banner dönüştürdü" cevaplanabiliyor; önceden
 * bütün kreatifler tek BTag torbasına düşüyordu.
 */

const TUR_ADI: Record<MedyaTuru, string> = {
  banner: 'Banner',
  metin: 'Metin linki',
  video: 'Video',
  landing: 'Landing',
};

const TUR_IKONU: Record<MedyaTuru, typeof Image> = {
  banner: Image,
  metin: Link2,
  video: Video,
  landing: Link2,
};

const bosForm: MedyaGirdisi = { ad: '', tur: 'banner', varlikUrl: '', hedefUrl: '', olcu: '', not: '' };

export function MedyaSekmesi() {
  const queryClient = useQueryClient();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Medya | null>(null);
  const [form, setForm] = useState<MedyaGirdisi>(bosForm);
  const [hata, setHata] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-medya'],
    queryFn: () => affiliateAdminApi.medyalar(),
  });

  const kapat = () => {
    setFormAcik(false);
    setDuzenlenen(null);
    setForm(bosForm);
    setHata('');
  };

  const yenile = () => queryClient.invalidateQueries({ queryKey: ['affiliate-medya'] });

  const kaydet = useMutation({
    mutationFn: () =>
      duzenlenen ? affiliateAdminApi.medyaGuncelle(duzenlenen.id, form) : affiliateAdminApi.medyaEkle(form),
    onSuccess: (cevap) => {
      if (!cevap.ok) {
        setHata(cevap.message || 'Kaydedilemedi.');
        return;
      }
      kapat();
      yenile();
    },
    onError: (e: Error) => setHata(e.message),
  });

  const sil = useMutation({
    mutationFn: (id: string) => affiliateAdminApi.medyaSil(id),
    onSuccess: yenile,
  });

  const medyalar = data?.medyalar ?? [];

  const duzenle = (m: Medya) => {
    setDuzenlenen(m);
    setForm({
      ad: m.ad,
      tur: m.tur,
      varlikUrl: m.varlikUrl ?? '',
      hedefUrl: m.hedefUrl,
      olcu: m.olcu ?? '',
      not: m.not ?? '',
      aktif: m.aktif,
      ortakBTaglari: m.ortakBTaglari,
    });
    setFormAcik(true);
    setHata('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Medya ve kreatifler</h3>
          <p className="mt-1 text-xs text-[color:var(--panel-muted,#8a919c)]">
            Her medyanın kimliği izleme linkine gömülür; hangi kreatifin dönüştürdüğü ölçülebilir.
          </p>
        </div>
        <button type="button" onClick={() => (formAcik ? kapat() : setFormAcik(true))} className={BUTON_ANA}>
          <Plus size={14} /> Yeni medya
        </button>
      </div>

      {formAcik && (
        <div className={`${KART} space-y-3 p-4`}>
          <div className="flex items-center justify-between">
            <p className={ETIKET}>{duzenlenen ? 'Medyayı düzenle' : 'Yeni medya'}</p>
            <button type="button" onClick={kapat} className="text-[color:var(--panel-muted,#8a919c)] hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Alan etiket="Ad">
              <input className={GIRDI} value={form.ad ?? ''} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
            </Alan>
            <Alan etiket="Tür">
              <select className={GIRDI} value={form.tur ?? 'banner'} onChange={(e) => setForm({ ...form, tur: e.target.value })}>
                {(Object.keys(TUR_ADI) as MedyaTuru[]).map((t) => (
                  <option key={t} value={t}>{TUR_ADI[t]}</option>
                ))}
              </select>
            </Alan>
            <Alan etiket="Ölçü" ipucu="Banner için, örn. 300x250">
              <input className={GIRDI} value={form.olcu ?? ''} onChange={(e) => setForm({ ...form, olcu: e.target.value })} />
            </Alan>
            <Alan etiket="Hedef adres" ipucu="Tıklayanın gideceği yer; izleme parametreleri buraya eklenir.">
              <input className={GIRDI} value={form.hedefUrl ?? ''} onChange={(e) => setForm({ ...form, hedefUrl: e.target.value })} placeholder="https://site.com/kayit" />
            </Alan>
            <Alan etiket="Kreatif adresi" ipucu="Banner görseli veya video. Banner için zorunlu.">
              <input className={GIRDI} value={form.varlikUrl ?? ''} onChange={(e) => setForm({ ...form, varlikUrl: e.target.value })} placeholder="https://cdn.../banner.jpg" />
            </Alan>
            <Alan etiket="Kısıtlı ortaklar" ipucu="Virgülle ayrılmış BTag listesi. Boşsa herkese açık.">
              <input
                className={GIRDI}
                value={(form.ortakBTaglari ?? []).join(', ')}
                onChange={(e) => setForm({ ...form, ortakBTaglari: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </Alan>
          </div>

          <HataSatiri mesaj={hata} />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={kapat} className={BUTON_SESSIZ}>İptal</button>
            <button type="button" onClick={() => kaydet.mutate()} disabled={kaydet.isPending} className={BUTON_ANA}>
              {kaydet.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">Yükleniyor...</p>}

      {!isLoading && medyalar.length === 0 && (
        <BosDurum
          ikon={<Image size={28} />}
          baslik="Henüz medya yok"
          aciklama="Ortaklara vereceğiniz banner ve linkleri ekleyin; her birinin izleme linki ayrı ölçülür."
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {medyalar.map((m) => {
          const Ikon = TUR_IKONU[m.tur];
          return (
            <article key={m.id} className={`${KART} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-cyan-300">
                    <Ikon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{m.ad}</p>
                    <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)]">
                      {TUR_ADI[m.tur]}{m.olcu ? ` · ${m.olcu}` : ''}
                    </p>
                  </div>
                </div>
                <Rozet ton={m.aktif ? 'basarili' : 'notr'}>{m.aktif ? 'Aktif' : 'Pasif'}</Rozet>
              </div>

              <p className="mt-3 truncate text-[11px] text-[color:var(--panel-muted,#8a919c)]" title={m.hedefUrl}>
                {m.hedefUrl}
              </p>
              {m.ortakBTaglari.length > 0 && (
                <p className="mt-1 text-[11px] text-amber-300">Kısıtlı: {m.ortakBTaglari.join(', ')}</p>
              )}
              <p className="mt-2 text-[10px] text-[color:var(--panel-faint,#5c6470)]">
                {formatDateDisplay(m.createdAt)}
              </p>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => duzenle(m)} className={`${BUTON_SESSIZ} h-8 flex-1`}>Düzenle</button>
                <button
                  type="button"
                  onClick={() => sil.mutate(m.id)}
                  disabled={sil.isPending}
                  className="inline-flex h-8 items-center justify-center rounded-xl bg-rose-500/10 px-3 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
                  aria-label={`${m.ad} medyasını sil`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
