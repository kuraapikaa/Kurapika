import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Handshake,
  User,
  Link as LinkIcon,
  Users,
  MessageSquare,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BarChart3,
  Coins,
  LogIn,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { formsApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

/**
 * Ortaklik basvuru landing'i.
 *
 * Onceden yalnizca ciplak bir formdu: ziyaretci neden ortak olmasi
 * gerektigini, ne kazanacagini ve surecin nasil isledigini hicbir yerde
 * goremiyordu. Form oldugu gibi duruyor (CMS ayarlari, alan adlari,
 * gonderim yolu degismedi); ustune donusum icin gereken anlatim eklendi.
 *
 * Renkler maviden lobi altin paletine cekildi — sayfa lobinin geri
 * kalaniyla ayni yerde durmuyordu.
 */

/**
 * Komisyon kademeleri — TANITIM AMACLI.
 *
 * Gercek oran ortak bazinda Affiliate merkezinden ayarlaniyor
 * (affiliateAccountService.revsharePayi). Buradaki aralik yalnizca vitrin;
 * is tarafi oranlari degistirirse bu liste de guncellenmeli.
 */
const KOMISYON_KADEMELERI = [
  { aralik: '1 – 10 aktif oyuncu', oran: '%25', not: 'Başlangıç' },
  { aralik: '11 – 40 aktif oyuncu', oran: '%35', not: 'Yükselen ortak' },
  { aralik: '41+ aktif oyuncu', oran: '%45', not: 'Kıdemli ortak' },
];

const AVANTAJLAR = [
  {
    ikon: Coins,
    baslik: 'Ömür boyu gelir payı',
    metin: 'Yönlendirdiğiniz oyuncu aktif kaldığı sürece kazanmaya devam edersiniz. Tek seferlik ödeme değil.',
  },
  {
    ikon: BarChart3,
    baslik: 'Şeffaf ortak paneli',
    metin: 'Oyuncu sayısı, yatırım, net gelir ve hakedişiniz kendi panelinizde; sormanıza gerek kalmadan.',
  },
  {
    ikon: Wallet,
    baslik: 'Zamanında ödeme',
    metin: 'Dönem kapanışında hakediş teyit edilir ve anlaştığımız yöntemle ödenir.',
  },
  {
    ikon: ShieldCheck,
    baslik: 'Negatif devir yok',
    metin: 'Bir dönem net gelir eksiye düşerse bu tutar bir sonraki döneme devretmez; sıfırdan başlarsınız.',
  },
];

const ADIMLAR = [
  { no: '01', baslik: 'Başvurun', metin: 'Aşağıdaki formu doldurun. Kanalınızı ve kitlenizi tanıyalım.' },
  { no: '02', baslik: 'Görüşelim', metin: 'Ekibimiz 24 saat içinde iletişime geçer, komisyon modelini birlikte belirleriz.' },
  { no: '03', baslik: 'Bağlantınızı alın', metin: 'Size özel takip bağlantısı (BTag) ve ortak paneli girişiniz tanımlanır.' },
  { no: '04', baslik: 'Kazanmaya başlayın', metin: 'Performansınızı panelden izleyin, hakedişiniz dönem sonunda ödenir.' },
];

export function OrtaklikSayfasi() {
  const { content: pageContent } = useLobbyPageContent('partner');
  const [type, setType] = useState('Telegram Grubu');
  const [contact, setContact] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [audienceSize, setAudienceSize] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['forms-settings'],
    queryFn: () => formsApi.getSettings()
  });

  const settings = settingsData?.data || {
    partnershipTypes: [],
    partnershipActive: true,
    partnershipTitle: 'Ortaklık Başvurusu',
    partnershipDescription: 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık formu.',
    partnershipSuccessMessage: 'Ortaklık talebiniz başarıyla alınmıştır. Ekibimiz sizinle iletişime geçecektir.',
    partnershipButtonText: 'Başvuru Gönder',
  };

  useEffect(() => {
    if (settings.partnershipTypes.length > 0 && !type) {
      setType(settings.partnershipTypes[0]);
    }
  }, [settings.partnershipTypes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || !channelUrl.trim()) return;

    setStatus('loading');
    try {
       const res = await formsApi.submitPartnershipRequest({ type, contact, channelUrl, audienceSize, message });
       if (res.ok) {
          setStatus('success');
          setMsg(settings.partnershipSuccessMessage || pageContent.successDescription || res.message);
       } else {
          setStatus('error');
          setMsg(res.message || lobbyExtraText(pageContent, 'submitError', 'Bir hata oluştu.'));
       }
    } catch {
       setStatus('error');
       setMsg(lobbyExtraText(pageContent, 'connectionError', 'Bağlantı hatası.'));
    }
  };

  const alanSinifi =
    'h-[52px] w-full rounded-xl border border-[rgba(243,236,221,0.08)] bg-[#0a0806] px-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-[color:var(--lobby-gold,#e7c574)]/30';
  const etiketSinifi =
    'flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2';

  return (
    <div className="narcos-lobby min-h-screen overflow-x-hidden bg-[#0e0c09] font-lobby text-[color:var(--lobby-text,#f3ecdd)] flex flex-col">
      <LobbyMobileNav />

      <main className="relative mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-4 sm:py-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--lobby-gold,#e7c574)]/30 bg-[color:var(--lobby-gold,#e7c574)]/10">
            <Handshake size={30} className="text-[color:var(--lobby-gold,#e7c574)]" />
          </div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--lobby-gold,#e7c574)]/80">
            {pageContent.eyebrow}
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            {settings.partnershipTitle || pageContent.title || 'Ortaklık Başvurusu'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-[color:var(--lobby-muted,#8f8674)]">
            {settings.partnershipDescription
              || pageContent.subtitle
              || 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık programı.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#basvuru"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[color:var(--lobby-gold,#e7c574)] px-6 text-sm font-black text-[#0e0c09] transition-opacity hover:opacity-90"
            >
              Hemen Başvur
            </a>
            {/* Mevcut ortaklar dogrudan panele gitsin; basvuru formunu
                yeniden doldurmaya calisiyorlardi. */}
            <a
              href="/ortak.html"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[rgba(243,236,221,0.12)] px-6 text-sm font-bold text-[color:var(--lobby-text,#f3ecdd)] transition-colors hover:border-[color:var(--lobby-gold,#e7c574)]/40"
            >
              <LogIn size={15} aria-hidden="true" /> Ortak Girişi
            </a>
          </div>
        </motion.section>

        {/* ── Avantajlar ───────────────────────────────────────────────── */}
        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AVANTAJLAR.map((avantaj) => (
            <div
              key={avantaj.baslik}
              className="rounded-2xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.02)] p-5"
            >
              <div className="mb-3 inline-flex rounded-xl bg-[color:var(--lobby-gold,#e7c574)]/10 p-2.5 text-[color:var(--lobby-gold,#e7c574)]">
                <avantaj.ikon size={18} aria-hidden="true" />
              </div>
              <h2 className="text-sm font-black">{avantaj.baslik}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--lobby-muted,#8f8674)]">{avantaj.metin}</p>
            </div>
          ))}
        </section>

        {/* ── Komisyon kademeleri ──────────────────────────────────────── */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.02)]">
          <div className="border-b border-[rgba(243,236,221,0.06)] px-5 py-4">
            <h2 className="text-sm font-black">Gelir paylaşımı kademeleri</h2>
            <p className="mt-1 text-xs text-[color:var(--lobby-muted,#8f8674)]">
              Aktif oyuncu sayınız arttıkça payınız yükselir. Kıdemli ortaklar için özel koşullar görüşülebilir.
            </p>
          </div>
          <ul className="divide-y divide-[rgba(243,236,221,0.05)]">
            {KOMISYON_KADEMELERI.map((kademe) => (
              <li key={kademe.aralik} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="text-sm font-bold">{kademe.aralik}</div>
                  <div className="text-[11px] text-[color:var(--lobby-muted,#8f8674)]">{kademe.not}</div>
                </div>
                <div className="text-xl font-black tabular-nums text-[color:var(--lobby-gold,#e7c574)]">{kademe.oran}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Nasıl işler ──────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-center text-sm font-black uppercase tracking-widest text-[color:var(--lobby-muted,#8f8674)]">
            Nasıl işler?
          </h2>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADIMLAR.map((adim) => (
              <li
                key={adim.no}
                className="rounded-2xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.02)] p-5"
              >
                <div className="text-2xl font-black text-[color:var(--lobby-gold,#e7c574)]/30">{adim.no}</div>
                <h3 className="mt-2 text-sm font-black">{adim.baslik}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--lobby-muted,#8f8674)]">{adim.metin}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Başvuru formu ────────────────────────────────────────────── */}
        <motion.section
          id="basvuru"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-6 w-full max-w-lg scroll-mt-6 overflow-hidden rounded-[1.8rem] border border-[rgba(243,236,221,0.10)] bg-[#141009] shadow-2xl"
        >
          <div className="border-b border-[rgba(243,236,221,0.05)] bg-gradient-to-b from-[color:var(--lobby-gold,#e7c574)]/10 to-transparent p-5 text-center sm:p-7">
            <h2 className="text-xl font-black">Başvuru formu</h2>
            <p className="mt-1.5 text-xs font-medium text-[color:var(--lobby-muted,#8f8674)]">
              Formu doldurun, 24 saat içinde dönelim.
            </p>
          </div>

          <div className="p-4 sm:p-7">
           {settingsLoading ? (
             <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[color:var(--lobby-muted,#8f8674)]" /></div>
           ) : !settings.partnershipActive ? (
             <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-2 text-rose-400">
                  <AlertCircle size={28} />
                </div>
                <h3 className="text-xl font-bold text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.unavailableTitle}</h3>
                <p className="text-[color:var(--lobby-muted,#8f8674)] text-sm">{pageContent.unavailableDescription}</p>
             </div>
           ) : (
             <AnimatePresence mode="wait">
             {status === 'success' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                   <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={30} className="text-emerald-400" />
                   </div>
                   <h3 className="text-xl font-bold text-[color:var(--lobby-text,#f3ecdd)] mb-2">{pageContent.successTitle}</h3>
                   <p className="text-emerald-400 text-sm font-medium">{msg}</p>
                   <button onClick={() => setStatus('idle')} className="mt-6 px-6 py-2 bg-[rgba(243,236,221,0.05)] rounded-full text-sm font-bold hover:bg-[rgba(243,236,221,0.10)]">{pageContent.successButton}</button>
                </motion.div>
             ) : (
                <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} className="space-y-4">
                   <div>
                      <label htmlFor="ortaklik-type" className={etiketSinifi}>
                        {pageContent.usernameLabel}
                      </label>
                      <select id="ortaklik-type" value={type} onChange={e=>setType(e.target.value)} className={alanSinifi}>
                         {settings.partnershipTypes.map((t: string, idx: number) => (
                           <option key={idx} value={t}>{t}</option>
                         ))}
                      </select>
                   </div>
                   <div>
                      <label htmlFor="ortaklik-channel" className={etiketSinifi}>
                        <LinkIcon size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'channelLabel', 'KANAL/SAYFA LİNKİ')}
                      </label>
                      <input id="ortaklik-channel" type="url" value={channelUrl} onChange={e=>setChannelUrl(e.target.value)} required placeholder={lobbyExtraText(pageContent, 'channelPlaceholder', 'https://...')} className={alanSinifi} />
                   </div>
                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     <div>
                        <label htmlFor="ortaklik-audience" className={etiketSinifi}>
                          <Users size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'audienceLabel', 'KİTLE SAYISI')}
                        </label>
                        <input id="ortaklik-audience" type="text" value={audienceSize} onChange={e=>setAudienceSize(e.target.value)} placeholder={lobbyExtraText(pageContent, 'audiencePlaceholder', 'Örn: 50K')} className={alanSinifi} />
                     </div>
                     <div>
                        <label htmlFor="ortaklik-contact" className={etiketSinifi}>
                          <User size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'contactLabel', 'İLETİŞİM')}
                        </label>
                        <input id="ortaklik-contact" type="text" value={contact} onChange={e=>setContact(e.target.value)} required placeholder={lobbyExtraText(pageContent, 'contactPlaceholder', '@KullaniciAdi')} className={alanSinifi} />
                     </div>
                   </div>
                   <div>
                      <label htmlFor="ortaklik-message" className={etiketSinifi}>
                        <MessageSquare size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'messageLabel', 'EK MESAJ')}
                      </label>
                      <textarea id="ortaklik-message" value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder={lobbyExtraText(pageContent, 'messagePlaceholder', 'Belirtmek istediğiniz detaylar...')} className="w-full resize-none rounded-xl border border-[rgba(243,236,221,0.08)] bg-[#0a0806] px-4 py-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-[color:var(--lobby-gold,#e7c574)]/30" />
                   </div>
                   {status === 'error' && <div className="text-rose-400 text-sm font-bold">{msg}</div>}
                   <button disabled={status==='loading'} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--lobby-gold,#e7c574)] font-black text-[#0e0c09] transition-all hover:opacity-90 disabled:opacity-60">
                      {status === 'loading' ? <Loader2 className="animate-spin" /> : (settings.partnershipButtonText || pageContent.primaryButton || 'Başvuru Gönder')}
                   </button>
                </motion.form>
              )}
             </AnimatePresence>
            )}
          </div>
        </motion.section>

        <p className="pb-6 text-center text-[11px] leading-relaxed text-[color:var(--lobby-muted,#8f8674)]">
          Zaten ortak mısınız?{' '}
          <a href="/ortak.html" className="font-bold text-[color:var(--lobby-gold,#e7c574)] hover:underline">
            Ortak paneline giriş yapın
          </a>
          .
        </p>
      </main>
    </div>
  );
}
