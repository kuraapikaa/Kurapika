import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  DatabaseZap,
  ExternalLink,
  Globe,
  Loader2,
  Pause,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { masterApi } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * MASTER PANELİ — SİTE AYARLARI.
 *
 * ── Neden bu kadar az alan var ────────────────────────────────────────
 * Panel eskiden tema rengi, logo, panel başlığı, partner ID, bitiş
 * tarihi, cihaz parmak izi, OTP algoritması/hane/periyot, saat dilimi ve
 * iki ayrı backoffice token'ı da soruyordu. Bunların çoğu hiç
 * doldurulmuyordu ve dolduranı da yanıltıyordu: bir sitenin ÇALIŞMASI
 * için gereken şey aşağıdaki dokuz değer. Geri kalanı ya varsayılanıyla
 * doğru çalışıyor ya da o sitede hiç kullanılmıyordu.
 *
 * Bu dokuz değer sunucudaki ortam değişkenlerinin site başına
 * karşılığıdır; boş bırakılan her alan o ortam değişkenine düşer — yani
 * BAŞKA bir sitenin değerine. Bu yüzden her alanın yanında ENV adı
 * yazıyor: panelde gördüğünüz kutunun sunucuda hangi değeri ezdiği
 * tahmin edilmek zorunda kalmasın.
 *
 * ── Listede olmayan ama tutulan iki alan ──────────────────────────────
 * `siteName` ve `domain` ayar değil, KİMLİK. Domain, çok kiracılı
 * çözümlemenin tek anahtarı: gelen isteğin hangi siteye ait olduğu
 * yalnızca ondan bulunuyor. Domainsiz bir site panelde görünür ama
 * hiçbir istek ona ulaşmaz ve tüm trafik yedek kiracıya düşer.
 */

type AyarTipi = 'metin' | 'sir' | 'sayi';

type AyarTanimi = {
  anahtar: string;
  env: string;
  etiket: string;
  tip: AyarTipi;
  /** 'tenant' = site kaydı, 'lynon' = site bağlantı kaydı. */
  hedef: 'tenant' | 'lynon';
  /** Bağlantı kaydındaki/site kaydındaki gerçek alan adı. */
  alan: string;
  yerTutucu?: string;
  ipucu?: string;
};

/** Panel yönetici girişi — bu sitenin kendi admin hesabı. */
const PANEL_AYARLARI: AyarTanimi[] = [
  {
    anahtar: 'adminUser', env: 'ADMIN_USER', etiket: 'Panel kullanıcı adı',
    tip: 'metin', hedef: 'tenant', alan: 'adminEmail',
    yerTutucu: 'admin',
    // Kayıtta alan adı `adminEmail` ama giriş bunu KULLANICI ADI olarak
    // karşılaştırıyor (auth.ts). Etiketin "e-posta" demesi yanlıştı.
    ipucu: 'Bu siteye panelden giriş yaparken kullanılan ad.',
  },
  {
    anahtar: 'adminPass', env: 'ADMIN_PASS', etiket: 'Panel şifresi',
    tip: 'sir', hedef: 'tenant', alan: 'adminPassword',
    ipucu: 'Boş bırakılırsa mevcut şifre korunur.',
  },
];

/** Lynon backoffice bağlantısı. */
const LYNON_AYARLARI: AyarTanimi[] = [
  {
    anahtar: 'backofficeBaseUrl', env: 'LYNON_BACKOFFICE_BASE_URL', etiket: 'Backoffice adresi',
    tip: 'metin', hedef: 'lynon', alan: 'backofficeBaseUrl',
    yerTutucu: 'https://backoffice.site.com',
  },
  {
    anahtar: 'idBaseUrl', env: 'LYNON_ID_BASE_URL', etiket: 'Kimlik (ID) adresi',
    tip: 'metin', hedef: 'lynon', alan: 'idBaseUrl',
    yerTutucu: 'https://id.site.com',
    ipucu: 'İki adımlı doğrulama bu adrese yapılıyor.',
  },
  {
    anahtar: 'siteId', env: 'LYNON_SITE_ID', etiket: 'Site ID',
    tip: 'sayi', hedef: 'lynon', alan: 'siteId', yerTutucu: '137',
  },
  {
    anahtar: 'currency', env: 'LYNON_CURRENCY', etiket: 'Para birimi',
    tip: 'metin', hedef: 'lynon', alan: 'currency', yerTutucu: 'TRY',
  },
  {
    anahtar: 'username', env: 'LYNON_PANEL_USERNAME', etiket: 'Lynon kullanıcı adı',
    tip: 'metin', hedef: 'lynon', alan: 'username', yerTutucu: 'raporcu',
  },
  {
    anahtar: 'password', env: 'LYNON_PANEL_PASSWORD', etiket: 'Lynon şifresi',
    tip: 'sir', hedef: 'lynon', alan: 'password',
  },
  {
    anahtar: 'otpSecret', env: 'LYNON_PANEL_OTP_SECRET', etiket: 'OTP sırrı (TOTP)',
    tip: 'sir', hedef: 'lynon', alan: 'otpSecret',
    yerTutucu: 'Base32 (A-Z, 2-7)',
    ipucu: 'Authenticator kurulum sırrı veya otpauth:// bağlantısının tamamı. Doğruluğunu aşağıdaki anlık kodla sınayın.',
  },
];

const TUM_AYARLAR = [...PANEL_AYARLARI, ...LYNON_AYARLARI];

type Form = { siteName: string; domain: string } & Record<string, string>;

const bosForm = (): Form => {
  const temel: Form = { siteName: '', domain: '' };
  for (const ayar of TUM_AYARLAR) temel[ayar.anahtar] = '';
  return temel;
};

export function MasterPanel() {
  const queryClient = useQueryClient();
  const [arama, setArama] = useState('');
  /** Açık olan düzenleyici: 'yeni' | site nesnesi | null. */
  const [duzenlenen, setDuzenlenen] = useState<'yeni' | any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['master-tenants'],
    queryFn: () => masterApi.getTenants(),
  });

  /**
   * Çok kiracılı çözümlemenin durumu. Panel site listesini gösteriyordu
   * ama isteklerin hangi kiracıya düştüğünü göstermiyordu; veritabanı
   * silindiğinde site sayısı sıfıra düştü, her istek yedek kiracıya
   * gitmeye başladı ve panel çalışmaya devam ettiği için fark edilmedi.
   */
  const { data: durum } = useQuery({
    queryKey: ['master-durum'],
    queryFn: () => masterApi.getDurum(),
    refetchInterval: 60_000,
  });

  const siteler = data?.data || [];
  const suzulmus = useMemo(() => {
    const terim = arama.trim().toLocaleLowerCase('tr-TR');
    if (!terim) return siteler;
    return siteler.filter((site: any) =>
      [site.siteName, site.domain, site.adminEmail]
        .filter(Boolean)
        .some((deger: any) => String(deger).toLocaleLowerCase('tr-TR').includes(terim))
    );
  }, [arama, siteler]);

  const sayilar = useMemo(() => {
    const aktif = siteler.filter((site: any) => site.isActive).length;
    return { toplam: siteler.length, aktif, pasif: siteler.length - aktif };
  }, [siteler]);

  const durumDegistir = useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      masterApi.updateTenant(args.id, { isActive: args.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['master-durum'] });
    },
    onError: () => toast.error('Durum değiştirilemedi'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white/[0.02] text-slate-200">
        <Loader2 size={34} className="animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="master-shell min-h-screen overflow-hidden bg-[#07090e] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.11),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(168,85,247,.10),transparent_28%),linear-gradient(180deg,#070b11,#080d14)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <main className="relative mx-auto w-full max-w-[1500px] space-y-4 p-4">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.05] bg-white/10 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 grid-cols-2 place-items-center gap-1 rounded-full border border-purple-400/25 bg-blue-400/[0.1] p-2.5 text-purple-300">
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/75">Master control</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-[-0.03em] text-white md:text-2xl">Siteler</h1>
              <p className="mt-1 max-w-2xl text-xs font-medium text-slate-400">
                Her sitenin kendi Lynon bağlantısı ve panel girişi. Boş bırakılan alan sunucunun ortam değişkenine düşer.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={arama}
                onChange={(event) => setArama(event.target.value)}
                className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] pl-9 pr-3 text-xs font-semibold text-white outline-none backdrop-blur-xl transition focus:border-blue-400/40 sm:w-64"
                placeholder="Site, domain veya kullanıcı ara"
              />
            </div>
            <button
              onClick={() => setDuzenlenen((mevcut: any) => (mevcut === 'yeni' ? null : 'yeni'))}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-400 px-4 text-xs font-bold text-white transition hover:bg-blue-300"
            >
              <Plus size={18} /> Yeni site
            </button>
          </div>
        </header>

        <CozumlemeSeridi durum={durum} />

        <section className="grid grid-cols-3 gap-4">
          <SayiKarti etiket="Toplam site" deger={sayilar.toplam} ikon={Server} ton="cyan" />
          <SayiKarti etiket="Aktif" deger={sayilar.aktif} ikon={CheckCircle2} ton="emerald" />
          <SayiKarti etiket="Pasif" deger={sayilar.pasif} ikon={Pause} ton="rose" />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suzulmus.map((site: any) => (
            <SiteKarti
              key={site.id}
              site={site}
              onAyarlar={() => setDuzenlenen(site)}
              onDurum={() => durumDegistir.mutate({ id: site.id, isActive: !site.isActive })}
              islemde={durumDegistir.isPending}
            />
          ))}

          {suzulmus.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-white/[0.05] bg-white/10 py-12 text-center backdrop-blur-xl">
              <Sparkles className="mx-auto mb-4 text-slate-500" size={32} />
              <p className="text-sm font-bold text-slate-400">Gösterilecek site yok.</p>
              <p className="mt-1 text-xs text-slate-500">Aramayı temizleyin veya yeni site ekleyin.</p>
            </div>
          )}
        </section>
      </main>

      {duzenlenen && (
        <SiteDuzenleyici
          site={duzenlenen === 'yeni' ? null : duzenlenen}
          onKapat={() => setDuzenlenen(null)}
          yedekAnahtar={durum?.yedekAnahtar || 'default'}
        />
      )}
    </div>
  );
}

/**
 * ÇOK KİRACILI ÇÖZÜMLEME DURUMU.
 *
 * Üç sessiz arıza burada görünür oluyor:
 *  1. Hiç site yok  → her istek yedek kiracıya düşer ve bonus kuralları,
 *     oyun ayarları, kimlikler siteler arasında PAYLAŞILIR.
 *  2. Domain'i olmayan aktif site → host eşleşmesi onu hiç bulamaz;
 *     panelde görünür ama hiçbir istek ona ulaşmaz.
 *  3. Aynı domain iki sitede → eşleşme ilk siteye gider, diğeri sessizce
 *     erişilemez olur.
 *
 * Üçü de panel "çalışıyor" görünürken olur; bu yüzden uyarıyı düzeltmenin
 * yapılacağı yerde, listenin üstünde gösteriyoruz.
 */
function CozumlemeSeridi({ durum }: { durum: any }) {
  if (!durum?.ok) return null;
  const tanilama = durum.tanilama || {};
  const alanAdiOlmayan: string[] = durum.alanAdiOlmayan || [];
  const cakisanlar: Array<{ domain: string; siteler: string[] }> = durum.cakisanAlanAdlari || [];
  const sorunlar: Array<{ tur: 'kritik' | 'uyari'; metin: string }> = [];

  if (tanilama.uyari) sorunlar.push({ tur: 'kritik', metin: tanilama.uyari });
  if (alanAdiOlmayan.length > 0) {
    sorunlar.push({
      tur: 'uyari',
      metin: `Domain tanımsız: ${alanAdiOlmayan.join(', ')}. Host eşleşmesi bu siteleri bulamaz; istekler "${durum.yedekAnahtar}" kiracısına düşer.`,
    });
  }
  for (const c of cakisanlar) {
    sorunlar.push({
      tur: 'kritik',
      metin: `"${c.domain}" birden fazla siteye tanımlı (${c.siteler.join(', ')}). Eşleşme ilkine gider, diğerleri erişilemez kalır.`,
    });
  }

  if (sorunlar.length === 0) {
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-200">
          <CheckCircle2 size={16} />
          <span>Çözümleme sağlıklı — {tanilama.aktifSite} aktif site domainiyle eşleşiyor.</span>
          <span className="font-medium text-emerald-200/70">Eşleşmeyen istekler: {durum.yedekAnahtar}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
        <ShieldAlert size={16} /> Çok kiracılı çözümleme
      </div>
      {sorunlar.map((sorun, i) => (
        <p
          key={i}
          className={cn('text-xs font-semibold leading-relaxed', sorun.tur === 'kritik' ? 'text-rose-200' : 'text-amber-200/90')}
        >
          {sorun.metin}
        </p>
      ))}
      <p className="pt-1 text-[11px] font-medium text-amber-200/60">
        Toplam {tanilama.siteSayisi ?? 0} site, {tanilama.aktifSite ?? 0} aktif. Eşleşmeyen istekler "{durum.yedekAnahtar}" kiracısına düşer.
      </p>
    </section>
  );
}

function SayiKarti({ etiket, deger, ikon: Ikon, ton }: { etiket: string; deger: number; ikon: any; ton: 'cyan' | 'emerald' | 'rose' }) {
  const tonSinifi = {
    cyan: 'bg-[color:var(--panel-info,#64d2ff)]/10 text-cyan-300 border-cyan-300/20',
    emerald: 'bg-emerald-300/10 text-emerald-300 border-emerald-300/20',
    rose: 'bg-rose-300/10 text-rose-300 border-rose-300/20',
  }[ton];

  return (
    <div className="rounded-3xl border border-white/[0.05] bg-white/10 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{etiket}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border', tonSinifi)}>
          <Ikon size={18} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-white">{deger}</p>
    </div>
  );
}

function SiteKarti({ site, onAyarlar, onDurum, islemde }: { site: any; onAyarlar: () => void; onDurum: () => void; islemde: boolean }) {
  const domainYok = !String(site.domain ?? '').trim();

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/[0.05] bg-white/10 p-5 backdrop-blur-xl transition hover:border-purple-400/25">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.035]">
            <Globe className={cn(domainYok ? 'text-amber-300' : 'text-cyan-300')} size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold tracking-[-0.025em] text-white">{site.siteName || 'İsimsiz site'}</h3>
            {domainYok ? (
              <span className="mt-1 inline-block text-xs font-bold text-amber-300" title="Host eşleşmesi bu siteyi bulamaz">
                domain tanımsız
              </span>
            ) : (
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-slate-400 transition hover:text-cyan-300"
              >
                {site.domain} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onDurum}
          disabled={islemde}
          className={cn(
            'shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition disabled:cursor-wait disabled:opacity-70',
            site.isActive ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300' : 'border-rose-300/20 bg-rose-300/10 text-rose-300'
          )}
        >
          {site.isActive ? 'Aktif' : 'Pasif'}
        </button>
      </div>

      <div className="mt-4 space-y-1.5">
        <BilgiSatiri etiket="ADMIN_USER" deger={site.adminEmail || 'Tanımsız'} />
        <BilgiSatiri etiket="Kiracı" deger={site.id} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onAyarlar}
          className="flex h-8 flex-1 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.08] text-[10px] font-bold text-cyan-200 backdrop-blur-xl transition hover:bg-cyan-300/[0.14]"
        >
          <span className="inline-flex items-center gap-2"><Settings size={14} /> Ayarlar</span>
        </button>
        <button
          onClick={onDurum}
          disabled={islemde}
          className={cn(
            'flex h-8 flex-1 items-center justify-center rounded-xl text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-70',
            site.isActive ? 'bg-rose-400/10 text-rose-300 hover:bg-rose-400/15' : 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
          )}
        >
          <span className="inline-flex items-center gap-2">
            {site.isActive ? <Pause size={14} /> : <Play size={14} />} {site.isActive ? 'Pasifleştir' : 'Aktifleştir'}
          </span>
        </button>
      </div>
    </article>
  );
}

function BilgiSatiri({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2 rounded-3xl border border-white/[0.05] bg-black/15 px-2.5 py-1 text-[11px] backdrop-blur-xl">
      <span className="w-24 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-500">{etiket}</span>
      <span className="min-w-0 truncate font-semibold text-slate-200">{deger}</span>
    </div>
  );
}

/**
 * TEK DÜZENLEYİCİ.
 *
 * Ayarlar eskiden İKİ yere bölünmüştü: site bilgileri "Ayarlar"
 * penceresinde, Lynon bilgileri ayrı bir "Bağlantı" penceresinde. Yeni
 * site kurarken ikincisi ancak site oluştuktan SONRA açılabiliyordu;
 * arada kalan sitenin hiçbir kimliği yoktu ve o boşlukta çalışan her
 * arka plan işi sessizce ortam değişkenindeki — yani başka bir sitenin —
 * bilgilerine düşüyordu.
 *
 * Artık tek pencere: dokuz ayar, kaydet, ve sırrı doğrulamak için anlık
 * TOTP kodu.
 */
function SiteDuzenleyici({ site, onKapat, yedekAnahtar }: { site: any | null; onKapat: () => void; yedekAnahtar: string }) {
  const queryClient = useQueryClient();
  const yeni = site === null;
  const [form, setForm] = useState<Form>(() => ({
    ...bosForm(),
    siteName: site?.siteName || '',
    domain: site?.domain || '',
    adminUser: site?.adminEmail || '',
  }));
  const [testSonucu, setTestSonucu] = useState<{ ok: boolean; message: string } | null>(null);

  /** Mevcut sitenin kayıtlı değerleri — sırlar maskeli gelir. */
  const { data: baglanti, isLoading: baglantiYukleniyor } = useQuery({
    queryKey: ['master-connection', site?.id],
    queryFn: () => masterApi.getConnection(site.id),
    enabled: !yeni,
  });

  const mevcut = baglanti?.data?.lynon;
  const sifrelemeHazir = baglanti?.sifrelemeHazir !== false;

  const alan = (anahtar: string, deger: string) => setForm((c) => ({ ...c, [anahtar]: deger }));

  /** Form değerlerini sunucunun beklediği iki gövdeye ayırır. */
  const govdeler = () => {
    const lynon: Record<string, string> = {};
    for (const ayar of LYNON_AYARLARI) {
      const deger = String(form[ayar.anahtar] ?? '').trim();
      if (deger) lynon[ayar.alan] = deger;
    }
    return {
      tenant: {
        siteName: form.siteName.trim(),
        domain: form.domain.trim(),
        adminEmail: String(form.adminUser ?? '').trim(),
        adminPassword: String(form.adminPass ?? '').trim(),
      },
      lynon,
    };
  };

  const olustur = useMutation({
    mutationFn: () => {
      const { tenant, lynon } = govdeler();
      return masterApi.createTenant({ ...tenant, lynon });
    },
    onSuccess: (cevap: any) => {
      if (cevap?.ok === false) return toast.error(cevap.message || 'Site oluşturulamadı');
      // Site oluştu ama sırlar yazılamadıysa bunu YUTMA.
      if (cevap?.baglantiUyarisi) toast.warning(cevap.baglantiUyarisi);
      else toast.success('Site oluşturuldu');
      if (cevap?.generatedPassword) {
        toast.info(`Üretilen panel şifresi: ${cevap.generatedPassword}`, { duration: 30_000 });
      }
      queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['master-durum'] });
      onKapat();
    },
    onError: () => toast.error('Site oluşturulamadı'),
  });

  const guncelle = useMutation({
    mutationFn: async () => {
      const { tenant, lynon } = govdeler();
      const siteCevabi = await masterApi.updateTenant(site.id, tenant);
      if (siteCevabi?.ok === false) throw new Error(siteCevabi.message || 'Site bilgileri kaydedilemedi');
      // Lynon alanlarının hiçbiri girilmediyse bağlantıya HİÇ dokunma:
      // boş bir istek göndermek gereksiz bir oturum sıfırlaması yapardı.
      if (Object.keys(lynon).length > 0) {
        const baglantiCevabi = await masterApi.updateConnection(site.id, { lynon });
        if (baglantiCevabi?.ok === false) throw new Error(baglantiCevabi.message || 'Bağlantı kaydedilemedi');
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Ayarlar kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['master-durum'] });
      queryClient.invalidateQueries({ queryKey: ['master-connection', site.id] });
      queryClient.invalidateQueries({ queryKey: ['master-otp', site.id] });
      // Sırlar maskeli döndüğü için alanları temizle: ekranda kalan metin
      // gerçek değer sanılıp yeniden kaydedilirse maskeyi sır yapardı.
      setForm((c) => {
        const temiz = { ...c };
        for (const ayar of TUM_AYARLAR) if (ayar.tip === 'sir') temiz[ayar.anahtar] = '';
        return temiz;
      });
    },
    onError: (hata: any) => toast.error(hata?.message || 'Kaydedilemedi'),
  });

  const test = useMutation({
    mutationFn: () => masterApi.testConnection(site.id),
    onSuccess: (cevap: any) => setTestSonucu({ ok: Boolean(cevap?.ok), message: cevap?.message || '' }),
    onError: (hata: any) => setTestSonucu({ ok: false, message: hata?.message || 'Bağlantı denenemedi.' }),
  });

  const kaydediliyor = olustur.isPending || guncelle.isPending;

  /**
   * Site adı ve domain sunucuda ZORUNLU. Önceden panelde hiçbir işaret
   * yoktu: kaydet'e basılıyor, istek 400 dönüyor, arayüz sessizce
   * hiçbir şey göstermiyordu.
   */
  const eksik = [
    !form.siteName.trim() && 'Site adı',
    !form.domain.trim() && 'Domain',
  ].filter(Boolean) as string[];

  const yerTutucu = (ayar: AyarTanimi) => {
    if (yeni) return ayar.yerTutucu || 'ENV değeri';
    if (ayar.hedef === 'tenant') return ayar.tip === 'sir' ? 'Boş: değiştirme' : (site?.adminEmail || ayar.yerTutucu || '');
    if (ayar.tip === 'sir') return mevcut?.[`${ayar.alan}Mask`] || 'ENV değeri';
    const deger = mevcut?.[ayar.alan];
    return deger != null && String(deger) !== '' ? String(deger) : 'ENV değeri';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative my-8 w-full max-w-3xl rounded-3xl border border-white/[0.05] bg-[#0b0f16]/95 p-6 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">
              {yeni ? 'Yeni site' : 'Site ayarları'}
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-white">
              {yeni ? 'Yeni site ekle' : site.siteName || site.domain}
            </h2>
            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-400">
              Boş bırakılan her alan sunucunun ortam değişkenindeki değeri kullanır — yani BAŞKA bir sitenin değerini.
            </p>
          </div>
          <button onClick={onKapat} className="rounded-3xl border border-white/[0.05] bg-white/[0.03] p-2 text-slate-400 backdrop-blur-xl transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!sifrelemeHazir && (
          <div className="mb-4 rounded-3xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-xs font-semibold text-amber-200 backdrop-blur-xl">
            <span className="inline-flex items-center gap-2"><ShieldAlert size={15} /> TENANT_SECRET_KEY tanımlı değil.</span>
            <p className="mt-1 font-medium text-amber-200/80">
              Şifre ve OTP sırrı şifrelenemediği için kaydedilemez. Adres ve site kimliği gibi sır olmayan alanlar kaydedilebilir.
            </p>
          </div>
        )}

        {!yeni && baglantiYukleniyor ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-cyan-300" /></div>
        ) : (
          <div className="space-y-5">
            <Bolum baslik="Kimlik" aciklama="Domain, çok kiracılı çözümlemenin tek anahtarı: gelen isteğin hangi siteye ait olduğu buradan bulunur.">
              <Alan etiket="Site adı" zorunlu value={form.siteName} onChange={(v) => alan('siteName', v)} placeholder="Örn: Narcos Bahis" />
              <Alan etiket="Domain" zorunlu value={form.domain} onChange={(v) => alan('domain', v)} placeholder="panel.site.com" ipucu="www. yazmayın; alt alan adları da eşleşir." />
            </Bolum>

            <Bolum baslik="Panel girişi">
              {PANEL_AYARLARI.map((ayar) => (
                <Alan
                  key={ayar.anahtar}
                  etiket={ayar.etiket}
                  env={ayar.env}
                  value={form[ayar.anahtar] ?? ''}
                  onChange={(v) => alan(ayar.anahtar, v)}
                  placeholder={yerTutucu(ayar)}
                  type={ayar.tip === 'sir' ? 'password' : 'text'}
                  ipucu={ayar.ipucu}
                />
              ))}
            </Bolum>

            <Bolum baslik="Lynon bağlantısı">
              {LYNON_AYARLARI.map((ayar) => (
                <Alan
                  key={ayar.anahtar}
                  etiket={ayar.etiket}
                  env={ayar.env}
                  value={form[ayar.anahtar] ?? ''}
                  onChange={(v) => alan(ayar.anahtar, v)}
                  placeholder={yerTutucu(ayar)}
                  type={ayar.tip === 'sir' ? 'password' : 'text'}
                  ipucu={ayar.ipucu}
                />
              ))}
            </Bolum>

            {!yeni && <TotpKarti tenantId={site.id} />}

            {!yeni && <VeriKopyalaKarti tenantId={site.id} yedekAnahtar={yedekAnahtar} />}

            {testSonucu && (
              <div className={cn(
                'rounded-3xl border p-4 text-xs font-semibold backdrop-blur-xl',
                testSonucu.ok ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200' : 'border-rose-300/25 bg-rose-300/[0.08] text-rose-200'
              )}>
                {testSonucu.ok ? 'Bağlantı kuruldu.' : testSonucu.message || 'Bağlantı kurulamadı.'}
              </div>
            )}

            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              {!yeni ? (
                <button
                  onClick={() => test.mutate()}
                  disabled={test.isPending}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-200 backdrop-blur-xl transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-70"
                >
                  {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                  {test.isPending ? 'Deneniyor...' : 'Bağlantıyı dene'}
                </button>
              ) : <span />}

              <div className="flex gap-3">
                <button onClick={onKapat} className="h-9 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-400 backdrop-blur-xl transition hover:text-white">
                  Kapat
                </button>
                <button
                  onClick={() => (yeni ? olustur.mutate() : guncelle.mutate())}
                  disabled={kaydediliyor || eksik.length > 0}
                  title={eksik.length > 0 ? `Zorunlu alan boş: ${eksik.join(', ')}` : undefined}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-400 px-5 text-xs font-bold text-white transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {kaydediliyor ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {kaydediliyor ? 'Kaydediliyor...' : yeni ? 'Siteyi oluştur' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * AYARLARI BAŞKA BİR SİTEDEN KOPYALA.
 *
 * Neden var: bu panelin bütün ayarları (bonus kuralları, oyun ayarları,
 * kampanyalar, lobi tasarımı) hiç site kaydı yokken `default` kiracısı
 * altında birikti. Siteyi buraya EKLEDİĞİNİZ an domain eşleşmeye başlıyor
 * ve aynı istek artık `default` yerine bu sitenin anahtarını okuyor --
 * panel bomboş açılıyor. Hiçbir şey silinmiyor, ama dışarıdan "ayarlar
 * uçtu" gibi görünüyor.
 *
 * Önce KURU GÖSTERİM çalışır: ne kopyalanacağı listelenir, hiçbir şey
 * yazılmaz. Yazma ayrı bir onayla yapılır -- geri alınamayan bir işlemi
 * tek tıkla yaptırmak, kurtarmaya çalıştığımız hatanın aynısı olurdu.
 */
function VeriKopyalaKarti({ tenantId, yedekAnahtar }: { tenantId: string; yedekAnahtar: string }) {
  const queryClient = useQueryClient();
  const [onizleme, setOnizleme] = useState<any>(null);
  const [uzerineYaz, setUzerineYaz] = useState(false);

  const calistir = useMutation({
    mutationFn: (kuru: boolean) =>
      masterApi.veriKopyala(tenantId, { kaynak: yedekAnahtar, kuruGosterim: kuru, uzerineYaz }),
    onSuccess: (cevap: any, kuru) => {
      if (cevap?.ok === false) return toast.error(cevap.message || 'Kopyalanamadı');
      setOnizleme(cevap);
      if (!kuru) {
        toast.success(`${cevap.kopyalanan} alan kopyalandı.`);
        queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
      }
    },
    onError: () => toast.error('Kopyalanamadı'),
  });

  const durumRengi = (durum: string) =>
    durum === 'kopyalandi' ? 'text-emerald-300'
      : durum === 'hata' ? 'text-rose-300'
        : 'text-slate-500';
  const durumMetni = (durum: string) =>
    durum === 'kopyalandi' ? 'kopyalanacak'
      : durum === 'hedefDolu' ? 'bu sitede zaten var — atlanacak'
        : durum === 'kaynakBos' ? 'kaynakta yok'
          : 'hata';

  return (
    <div className="rounded-3xl border border-white/[0.05] bg-black/20 p-5 backdrop-blur-xl">
      <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
        <DatabaseZap size={13} /> Ayarları "{yedekAnahtar}" kiracısından kopyala
      </p>
      <p className="mb-3 text-[11px] font-medium leading-relaxed text-slate-500">
        Bu siteyi eklemeden önceki ayarlar "{yedekAnahtar}" altında duruyor olabilir. Domain eşleşmeye
        başladığında panel onları okumayı bırakır; buradan kopyalayarak taşıyabilirsiniz.
        Kaynak <span className="font-bold text-slate-400">değişmez</span>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => calistir.mutate(true)}
          disabled={calistir.isPending}
          className="inline-flex h-8 items-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-3 text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60"
        >
          {calistir.isPending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Ne kopyalanacak?
        </button>

        {onizleme?.kuruGosterim && onizleme.kopyalanan > 0 && (
          <button
            onClick={() => calistir.mutate(false)}
            disabled={calistir.isPending}
            className="inline-flex h-8 items-center gap-2 rounded-xl bg-amber-400 px-3 text-[10px] font-bold text-black transition hover:bg-amber-300 disabled:opacity-60"
          >
            <DatabaseZap size={12} /> {onizleme.kopyalanan} alanı kopyala
          </button>
        )}

        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={uzerineYaz}
            onChange={(e) => { setUzerineYaz(e.target.checked); setOnizleme(null); }}
            className="h-3 w-3 accent-amber-400"
          />
          Bu sitedekilerin üzerine yaz
        </label>
      </div>

      {onizleme?.satirlar && (
        <div className="mt-3 space-y-1">
          {onizleme.satirlar
            .filter((satir: any) => satir.durum !== 'kaynakBos')
            .map((satir: any) => (
              <div key={satir.namespace} className="flex items-center justify-between gap-3 text-[10px]">
                <span className="font-semibold text-slate-300">{satir.ad}</span>
                <span className={cn('font-bold', durumRengi(satir.durum))}>
                  {satir.mesaj || durumMetni(satir.durum)}
                </span>
              </div>
            ))}
          {onizleme.kopyalanan === 0 && (
            <p className="text-[10px] font-semibold text-slate-500">
              Kopyalanacak bir şey yok.
            </p>
          )}
          <p className="pt-1 text-[10px] leading-relaxed text-slate-600">
            Oyuncu verisi kopyalanmaz ({(onizleme.kopyalanmayanAlanlar || []).join(', ')}): bunlar o sitenin
            kendi oyuncularına ait.
          </p>
        </div>
      )}
    </div>
  );
}

function Bolum({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/[0.05] bg-white/[0.015] p-5">
      <div className="mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{baslik}</h3>
        {aciklama && <p className="mt-1 max-w-2xl text-[11px] font-medium leading-relaxed text-slate-500">{aciklama}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * ENV adı etiketin yanında duruyor: panelde gördüğünüz kutunun sunucuda
 * hangi değeri ezdiği tahmin edilmek zorunda kalmasın.
 */
function Alan({ etiket, env, value, onChange, placeholder, type = 'text', zorunlu, ipucu }: {
  etiket: string;
  env?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  zorunlu?: boolean;
  ipucu?: string;
}) {
  return (
    <div>
      <label className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {etiket}
          {zorunlu && <span className="ml-1 text-rose-300" title="Zorunlu">*</span>}
        </span>
        {env && (
          <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-tight text-slate-500">
            {env}
          </code>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-3 text-xs font-semibold text-white outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-blue-400/40 [color-scheme:dark]"
        placeholder={placeholder}
      />
      {ipucu && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{ipucu}</p>}
    </div>
  );
}

/**
 * ANLIK TOTP KODU.
 *
 * Operatör OTP sırrını kaydediyor, doğru olup olmadığını ise ancak bir
 * sonraki gerçek girişin düşmesiyle öğreniyordu — ve o giriş gece yarısı
 * bir rapor işinin ortasında olabiliyor. Burada üretilen kod
 * authenticator uygulamasındakiyle aynıysa sır doğrudur.
 *
 * Kodu sunucu üretir, sır tarayıcıya HİÇ gelmez. Geri sayım yerelde
 * işler ama sıfıra ulaştığında kod sunucudan yeniden istenir; saati
 * kaymış bir makinede yerel hesap yanlış kod gösterirdi.
 */
function TotpKarti({ tenantId }: { tenantId: string }) {
  const [kalan, setKalan] = useState<number | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['master-otp', tenantId],
    queryFn: () => masterApi.getTenantOtp(tenantId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.kalanSaniye == null) { setKalan(null); return; }
    setKalan(data.kalanSaniye);
  }, [data]);

  useEffect(() => {
    if (kalan == null) return;
    if (kalan <= 0) { refetch(); return; }
    const t = setTimeout(() => setKalan((k) => (k == null ? null : k - 1)), 1000);
    return () => clearTimeout(t);
  }, [kalan, refetch]);

  const kopyala = async () => {
    if (!data?.kod) return;
    try {
      await navigator.clipboard.writeText(String(data.kod));
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  const periyot = Number(data?.periyot) || 30;
  const oran = kalan == null ? 0 : Math.max(0, Math.min(1, kalan / periyot));

  return (
    <div className="rounded-3xl border border-white/[0.05] bg-black/20 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          <Timer size={13} /> Anlık TOTP kodu
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-slate-300 transition hover:text-white disabled:opacity-60"
        >
          <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} /> Yenile
        </button>
      </div>

      {isFetching && !data ? (
        <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-cyan-300" /></div>
      ) : data?.ok ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={kopyala}
              title="Kopyala"
              className="group inline-flex items-center gap-3 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 transition hover:bg-cyan-300/[0.13]"
            >
              <span className="font-mono text-2xl font-bold tracking-[0.25em] text-cyan-200">{data.kod}</span>
              {kopyalandi ? <CheckCircle2 size={16} className="text-emerald-300" /> : <Copy size={16} className="text-cyan-300/60 group-hover:text-cyan-200" />}
            </button>

            {kalan != null && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', kalan <= 5 ? 'bg-rose-400' : 'bg-cyan-300')}
                    style={{ width: `${oran * 100}%` }}
                  />
                </div>
                <span className={cn('text-xs font-bold tabular-nums', kalan <= 5 ? 'text-rose-300' : 'text-slate-400')}>{kalan}s</span>
              </div>
            )}
          </div>

          {data.sabit ? (
            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-amber-200/90">{data.uyari}</p>
          ) : (
            <p className="mt-3 text-[11px] font-medium text-slate-500">
              {String(data.algoritma || '').toUpperCase()} · {data.hane} hane · {periyot}s.
              Authenticator uygulamanızdaki kodla aynıysa sır doğru kaydedilmiş.
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">{data?.message || 'Kod üretilemedi.'}</p>
      )}
    </div>
  );
}
