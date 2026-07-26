import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  X,
  Crown,
} from 'lucide-react';
import { bonusPanelApi, dashboardApi, adminApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { BonusPlaceholder } from '../ui/BonusPlaceholder';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraLines, lobbyExtraText, renderLobbyTemplate, useLobbyPageContent } from '../../lib/lobbyContent';
import { friendlyBonusEligibilityMessage } from '../../lib/bonusEligibilityMessages';

interface RichBonus {
  promoTitle: string;
  image: string;
  detailHtml?: string;
  rules: Record<string, any>;
  backofficeId: number | undefined;
  isFreebet: boolean;
  tags: string[];
  platformBonusDefinitionId?: number;
  backofficeName?: string;
}

function getBonusTags(rules: Record<string, any>): string[] {
  const tags: string[] = [];
  if (rules?.noWagering) tags.push('Çevrimsiz');
  if (rules?.lossBonus) tags.push('Kayıp Bonusu');
  if (rules?.firstDepositOnly) tags.push('İlk Yatırım');
  if (rules?.weeklyOnce) tags.push('Haftalık');
  if (rules?.vipOnly) tags.push('VIP');
  if (rules?.oneTimeOnly) tags.push('Tek Seferlik');
  if (rules?.bonusPercent) tags.push(`%${rules.bonusPercent}`);
  return tags;
}

export function BonusTalepSayfasi() {
  const { content: pageContent } = useLobbyPageContent('bonus');
  const categories = useMemo(() => lobbyExtraLines(pageContent, 'categories', ['Tümü', 'Yatırım Bonusları', 'Kayıp Bonusları', 'Hediye Bonuslar', 'Spor']), [pageContent]);
  const allCategory = categories[0] || 'Tümü';
  const depositCategory = categories[1] || 'Yatırım Bonusları';
  const lossCategory = categories[2] || 'Kayıp Bonusları';
  const giftCategory = categories[3] || 'Hediye Bonuslar';
  const sportsCategory = categories[4] || 'Spor';
  const [selectedCategory, setSelectedCategory] = useState(allCategory);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedBonus, setSelectedBonus] = useState<RichBonus | null>(null);
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');

  const [playerData, setPlayerData] = useState<any>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory(allCategory);
    }
  }, [allCategory, categories, selectedCategory]);

  // Oturum kontrolü
  useEffect(() => {
    bonusPanelApi.me().then(res => {
      if (res.ok) {
        setUsername(res.login);
        localStorage.setItem('saved_username', res.login);
      } else {
        const saved = localStorage.getItem('saved_username');
        if (saved) setUsername(saved);
      }
    });
  }, []);

  // Debounce username input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUsername(username.trim());
    }, 600);
    return () => clearTimeout(handler);
  }, [username]);

  // Fetch data
  const { data: promosRes, isLoading: promosLoading } = useQuery({
    queryKey: ['promos-list'],
    queryFn: () => dashboardApi.promosAutoList(),
    staleTime: 60 * 60 * 1000,
  });

  useQuery({
    queryKey: ['partner-bonuses-list'],
    queryFn: () => dashboardApi.partnerBonusList({}),
    staleTime: 30 * 60 * 1000,
  });

  useQuery({
    queryKey: ['freebet-bonuses'],
    queryFn: () => dashboardApi.freebetBonuses(),
    staleTime: 30 * 60 * 1000,
  });

  const richBonuses = useMemo(() => {
    const promotions: any[] = promosRes?.Data?.promotions ?? [];

    // 1. Ana Promosyonlar (Hali hazırda sunucuda Kural Motoruna göre filtrelendi)
    const list1 = promotions.map((p: any) => {
      const rules = p.rules ?? {};
      return {
        promoTitle: p.promoTitle || p.title || p.Name || p.name || p.systemName || 'Bonus',
        image: p.image || '',
        detailHtml: p.detailHtml || '',
        rules: rules,
        backofficeId: p.backofficeId ?? p.id,
        isFreebet: Boolean(p.isFreebet),
        tags: Array.isArray(p.tags) && p.tags.length ? p.tags : getBonusTags(rules),
        platformBonusDefinitionId: p.platformBonusDefinitionId || p.id
      };
    });

    return list1.filter((bonus) => bonus.rules?.enabled !== false);
  }, [promosRes]);

  const filteredBonuses = useMemo(() => {
    return richBonuses.filter(b => {
      if (selectedCategory === allCategory || !selectedCategory) return true;
      const titleLower = b.promoTitle.toLowerCase();
      const tagsStr = b.tags.join(' ').toLowerCase();

      if (selectedCategory === depositCategory) {
        return titleLower.includes('yatırım') || titleLower.includes('yatirim') || titleLower.includes('başla') || titleLower.includes('happy days');
      }
      if (selectedCategory === lossCategory) {
        return titleLower.includes('kayıp') || titleLower.includes('kayip') || titleLower.includes('discount');
      }
      if (selectedCategory === giftCategory) {
        return titleLower.includes('deneme') || titleLower.includes('freespin') || titleLower.includes('hediye') || titleLower.includes('çark') || titleLower.includes('cark') || titleLower.includes('doğum') || titleLower.includes('dogum');
      }
      if (selectedCategory === sportsCategory) {
        return titleLower.includes('spor') || tagsStr.includes('spor');
      }
      return true;
    });
  }, [allCategory, depositCategory, giftCategory, lossCategory, richBonuses, selectedCategory, sportsCategory]);

  const fetchPlayerData = useCallback(async (u: string, b: RichBonus) => {
    if (!u) {
      setPlayerData(null);
      return;
    }
    setPlayerLoading(true);
    setSubmitError(null);
    try {
      const loginRes = await bonusPanelApi.login(u);
      if (!loginRes.ok) {
        setPlayerData({ error: lobbyExtraText(pageContent, 'userNotFoundError', 'Kullanıcı adı bulunamadı.') });
        return;
      }

      localStorage.setItem('saved_username', u);

      const res = await adminApi.checkPlayer(u, { bonusId: b.backofficeId, bonusName: b.promoTitle });
      if (!res.HasError) {
        setPlayerData(res.Data);
      } else {
        setPlayerData({ error: lobbyExtraText(pageContent, 'accountError', 'Hesap bilgileri alınamadı.') });
      }
    } catch {
      setPlayerData({ error: lobbyExtraText(pageContent, 'connectionError', 'Sistem bağlantı hatası.') });
    } finally {
      setPlayerLoading(false);
    }
  }, [pageContent]);

  useEffect(() => {
    if (debouncedUsername && selectedBonus && isModalOpen) {
      fetchPlayerData(debouncedUsername, selectedBonus);
    } else {
      setPlayerData(null);
    }
  }, [debouncedUsername, selectedBonus, isModalOpen, fetchPlayerData]);

  const handleOpenModal = (b: RichBonus) => {
    setSelectedBonus(b);
    // Eğer session varsa username'i sıfırlama
    bonusPanelApi.me().then(res => {
       if (res.ok) {
          setUsername(res.login);
       } else {
          setUsername('');
          setPlayerData(null);
       }
    });
    setDebouncedUsername(username);
    setSubmitSuccess(null);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (b: RichBonus) => {
    setSelectedBonus(b);
    setIsDetailsOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBonus(null);
    setIsDetailsOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedBonus?.backofficeId || !playerData?.account?.id) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await adminApi.chargeBonus({ ClientId: playerData.account.id, BonusId: selectedBonus.backofficeId, AssignmentValues: selectedBonus.rules?.assignmentValues ?? {} });
      if ((res as any)?.HasError) {
        const rawMessage = String((res as any).AlertMessage || (res as any).ErrorDescription || '');
        setSubmitError(/uygun|kural|koşul|çevrim|bakiye|yatırım/i.test(rawMessage)
          ? 'Hesabınızın bonus uygunluğu yeniden değerlendirildi. Lütfen koşulları kontrol edip tekrar deneyin.'
          : 'Bonus talebiniz şu anda tamamlanamadı. Lütfen kısa süre sonra tekrar deneyin.');
      } else {
        setSubmitSuccess(renderLobbyTemplate(pageContent.successDescription, { bonus: selectedBonus.promoTitle }));
      }
    } catch {
      setSubmitError('Bonus talebiniz şu anda tamamlanamadı. Lütfen kısa süre sonra tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper functions for styling
  const getColorPrefix = (_bonus: RichBonus) => 'gold';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(135deg,_#030712_0%,_#07111f_40%,_#09192d_100%)] pb-6 text-slate-200 font-sans flex flex-col">
      <LobbyMobileNav active="bonus" />

      <div className="w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 md:p-8 flex-1 flex flex-col relative z-10 space-y-5 md:space-y-6">
        <header className="overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_28px_80px_rgba(2,12,32,0.55)] backdrop-blur-xl sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_30%)]" />
          <div className="relative z-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">
              <Crown size={14} /> {pageContent.eyebrow}
            </div>
            <h1 className="text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">{pageContent.title}</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-400 sm:text-base">{pageContent.subtitle}</p>
          </div>
        </header>

        {/* Category Pills */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap mb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "min-h-[44px] px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all border uppercase tracking-[0.08em] leading-tight",
                selectedCategory === cat
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                  : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {promosLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm font-bold text-zinc-500">
             <Loader2 className="animate-spin text-cyan-400" size={40} />
             {pageContent.loadingText}
          </div>
        )}

        {/* Bonus Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
            {filteredBonuses.map(bonus => {
              const prefix = getColorPrefix(bonus);
              const isClosed = bonus.backofficeId == null;

              const colorMap: Record<string, string> = {
                gold: "text-[#f4d36f] border-[#d4af37]/35 bg-[#d4af37]/10 hover:border-[#edc65f]/55 hover:bg-[#d4af37]/20",
              };
              const bgGradientMap: Record<string, string> = {
                gold: "from-[#d4af37]/25 to-transparent",
              };
              const btnColor = colorMap[prefix];
              const gradColor = bgGradientMap[prefix];

              // Try to extract a big number for the visual (like %25 or 250₺)
              const bigNumMatch = bonus.promoTitle.match(/(%\d+|\d+%|\d+₺|\d+ TL)/i);
              const bigNum = bigNumMatch ? bigNumMatch[1] : (bonus.tags.find((t: string) => t.includes('%')) || '');

              const primaryTag = bonus.tags[0] || lobbyExtraText(pageContent, 'genericTag', 'Genel Bonus');
              const cardDescription = renderLobbyTemplate(
                lobbyExtraText(pageContent, 'cardDescriptionTemplate', '{bonus}! Şansınızı ayrıcalıklarla deneyin, kazanma şansınızı katlayın. Eğlenceye hemen katılın.'),
                { bonus: bonus.promoTitle }
              );

              return (
                <div
                  key={bonus.promoTitle}
                  className="rounded-[1.55rem] sm:rounded-3xl border border-white/10 bg-slate-950/70 overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-[0_20px_50px_rgba(2,12,32,0.45)] hover:border-cyan-400/20"
                >
                  {/* Top Image Box */}
                  <div className="relative h-[168px] sm:h-[210px] md:h-[220px] w-full bg-[#151e2f] overflow-hidden">
                     {/* Ambient background glow inside image box */}
                     <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", gradColor)} />

                     {/* Glow element removed as per request */}


                     {/* The Image (if exists, else fallback shape) */}
                     <div className="absolute right-0 bottom-0 top-0 w-3/5 overflow-hidden flex items-end justify-end pointer-events-none">
                        {bonus.image ? (
                          <img
                            src={bonus.image}
                            alt="promosyon"
                            className="h-full object-cover object-right group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                              const next = (e.target as any).nextElementSibling;
                              if (next) next.style.display = 'flex';
                            }}
                          />
                        ) : null}

                        {/* Placeholder (hidden if img works, shown otherwise) */}
                        <div
                          className={cn(
                            "absolute inset-0 flex items-center justify-end p-0 pr-4 pointer-events-none",
                            bonus.image ? "hidden" : "flex"
                          )}
                          id={`placeholder-${bonus.promoTitle}`}
                        >
                           <BonusPlaceholder
                              size={160}
                              tone="amber"
                              className="bg-transparent border-none shadow-none"
                           />
                        </div>
                     </div>

                     <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10 flex flex-col gap-2">
                        {/* Tag */}
                        <div className="inline-flex">
                           <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm", btnColor)}>
                              {primaryTag}
                           </div>
                        </div>
                     </div>

                     <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 z-10 flex flex-col pt-4">
                        {bigNum && (
                           <span className={cn(
                              "text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter drop-shadow-md",
                              'text-cyan-300'
                           )}>
                              {bigNum}
                           </span>
                        )}
                        <span className="text-base sm:text-lg md:text-xl font-black text-white leading-tight uppercase drop-shadow-md max-w-[190px]">
                           {bonus.promoTitle.replace(bigNum, '').trim().split(' ').slice(0, 3).join('\n')}
                        </span>
                     </div>
                  </div>

                  {/* Bottom Text & Actions */}
                  <div className="p-4 sm:p-5 md:p-6 flex flex-col flex-1">
                     <h3 className="font-bold text-sm sm:text-[15px] text-white leading-snug line-clamp-2 min-h-[40px] mb-2">
                        {bonus.promoTitle}
                     </h3>
                     <p className="text-xs text-zinc-500 font-medium line-clamp-2 flex-1 mb-6">
                        {cardDescription}
                     </p>

                     <div className="flex flex-col gap-2 mt-auto min-[390px]:flex-row">
                        <button
                           type="button"
                           onClick={() => handleOpenDetails(bonus)}
                           aria-label={`${bonus.promoTitle} ${lobbyExtraText(pageContent, 'detailTitleSuffix', 'detaylarını görüntüle')}`}
                           className="flex-1 min-h-[46px] rounded-xl border border-white/10 bg-white/5 text-slate-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-white/10 hover:text-white transition-colors"
                        >
                           {pageContent.secondaryButton}
                        </button>
                        <button
                           type="button"
                           onClick={() => handleOpenModal(bonus)}
                           disabled={isClosed}
                           aria-label={isClosed ? `${bonus.promoTitle} ${lobbyExtraText(pageContent, 'closedAriaSuffix', 'şu an kapalı')}` : `${bonus.promoTitle} ${lobbyExtraText(pageContent, 'requestAriaSuffix', 'talep et')}`}
                           className={cn(
                              "flex-1 min-h-[46px] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors",
                              isClosed ? "opacity-50 grayscale cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500" : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/25 hover:bg-cyan-500/25"
                           )}
                        >
                           {isClosed ? lobbyExtraText(pageContent, 'closedButton', 'KAPALI') : pageContent.primaryButton} {!isClosed && <ChevronRight size={14} />}
                        </button>
                     </div>
                  </div>
                </div>
              );
            })}

          {filteredBonuses.length === 0 && !promosLoading && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 text-zinc-500">
              <Gift className="mx-auto mb-4 opacity-20" size={48} />
              <p className="font-bold text-lg text-zinc-400">{pageContent.emptyTitle}</p>
              {pageContent.emptyDescription && <p className="mt-2 text-sm font-medium">{pageContent.emptyDescription}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Bonus Request Modal */}
      <AnimatePresence>
        {isModalOpen && selectedBonus && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={closeModal}
            />

            <motion.div
               role="dialog"
               aria-modal="true"
               aria-labelledby="bonus-modal-title"
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: -20 }}
               className="bg-[#0f1523] border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md relative z-10 shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto"
            >
               {submitSuccess ? (
                  <div className="p-6 sm:p-8 text-center">
                     <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-emerald-400" />
                     </div>
                     <h2 className="text-2xl font-black text-white mb-3">{pageContent.successTitle}</h2>
                     <p className="text-emerald-400 font-bold mb-8">{submitSuccess}</p>

                     <button
                        onClick={closeModal}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl transition-colors"
                     >
                        {pageContent.successButton}
                     </button>
                  </div>
               ) : (
                  <>
                     <div className="sticky top-0 z-10 p-4 sm:p-6 border-b border-white/5 flex items-center justify-between gap-3 bg-[#0f1523]/95 backdrop-blur-xl">
                        <h3 className="min-w-0 truncate text-base sm:text-lg font-black text-white" id="bonus-modal-title">{renderLobbyTemplate(pageContent.formTitle, { bonus: selectedBonus.promoTitle })}</h3>
                        <button type="button" onClick={closeModal} aria-label={lobbyExtraText(pageContent, 'modalCloseLabel', 'Modalı kapat')} className="text-zinc-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg p-1">
                           <X size={20} aria-hidden="true" />
                        </button>
                     </div>

                     <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                        {pageContent.formDescription && (
                           <p className="text-sm font-medium leading-6 text-zinc-500">{pageContent.formDescription}</p>
                        )}
                        <div>
                           <label htmlFor="bonus-modal-username" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
                              <User size={14} aria-hidden="true" /> {pageContent.usernameLabel}
                           </label>
                           <input
                              id="bonus-modal-username"
                              type="text"
                              autoFocus
                              placeholder={pageContent.usernamePlaceholder}
                              value={username}
                              onChange={e => setUsername(e.target.value)}
                              autoComplete="username"
                              className="w-full bg-[#0a0f18] border border-white/5 rounded-xl px-4 py-4 text-white font-bold placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37]/30 transition-all"
                           />
                        </div>

                        {/* Status Area */}
                        {debouncedUsername ? (
                           playerLoading ? (
                              <div className="flex items-center justify-center gap-3 text-[#f4d36f] font-bold py-6 bg-[#d4af37]/5 rounded-xl border border-[#d4af37]/15">
                                 <Loader2 className="animate-spin" size={18} /> {lobbyExtraText(pageContent, 'checkingText', 'Hesap kontrol ediliyor...')}
                              </div>
                           ) : playerData?.error ? (
                              <div className="flex items-center gap-3 text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 font-bold text-sm">
                                 <XCircle size={20} className="shrink-0" />
                                 {playerData.error}
                              </div>
                           ) : playerData?.account ? (
                              <div className="space-y-4">
                                 <div className="flex flex-col gap-1 p-4 bg-black/40 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase">
                                       <span>{lobbyExtraText(pageContent, 'accountStatusLabel', 'Hesap Durumu')}</span>
                                       <span>{lobbyExtraText(pageContent, 'balanceLabel', 'Bakiye')}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                       <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                                          <ShieldCheck size={16} /> {lobbyExtraText(pageContent, 'verifiedText', 'Doğrulandı')}
                                       </span>
                                       <span className="font-black text-white">{playerData.account.balance?.toLocaleString('tr-TR')} ₺</span>
                                    </div>
                                 </div>

                                 {playerData.specificBonusCheck && (
                                    <div className="space-y-3">
                                       <div className={cn(
                                          "flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold leading-relaxed",
                                          playerData.specificBonusCheck.overallOk
                                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                            : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                       )}>
                                          <div className="mt-0.5 shrink-0">
                                             {playerData.specificBonusCheck.overallOk ? <CheckCircle2 size={16} /> : <Info size={16} />}
                                          </div>
                                          {playerData.specificBonusCheck.overallOk
                                            ? 'Hesabınız bu bonus için uygun görünüyor. Talebinizi gönderebilirsiniz.'
                                            : 'Bu bonus şu anda hesabınız için uygun görünmüyor. Koşulları tamamladıktan sonra yeniden deneyebilirsiniz.'}
                                       </div>

                                       {!playerData.specificBonusCheck.overallOk && (
                                          <div className="space-y-2">
                                             {playerData.specificBonusCheck.items.filter((item: any) => !item.ok).map((item: any) => {
                                                const friendly = friendlyBonusEligibilityMessage(item);
                                                return (
                                                   <div key={item.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
                                                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                                                      <div className="flex flex-col gap-1">
                                                         <span className="text-[11px] font-bold text-white">{friendly.title}</span>
                                                         <span className="text-[11px] font-medium leading-5 text-zinc-400">{friendly.message}</span>
                                                      </div>
                                                   </div>
                                                );
                                             })}
                                          </div>
                                       )}
                                    </div>
                                 )}

                                 {submitError && (
                                    <div className="text-rose-400 text-xs font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                                       {submitError}
                                    </div>
                                 )}

                                 <button
                                    onClick={handleSubmit}
                                    disabled={submitting || (playerData.specificBonusCheck && !playerData.specificBonusCheck.overallOk)}
                                    className="w-full flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#edc65f] text-black py-4 rounded-xl font-black transition-all disabled:opacity-50 disabled:grayscale"
                                 >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                    {submitting
                                      ? lobbyExtraText(pageContent, 'submitLoading', 'Talep Gönderiliyor...')
                                      : (playerData.specificBonusCheck && !playerData.specificBonusCheck.overallOk
                                        ? 'Şu anda uygun değil'
                                        : pageContent.submitButton)}
                                 </button>
                              </div>
                           ) : null
                        ) : (
                           <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm font-bold py-6 px-4 text-center bg-black/20 rounded-xl border border-white/5">
                              {lobbyExtraText(pageContent, 'usernamePrompt', 'Onaylamak için kullanıcı adınızı yazın.')}
                           </div>
                        )}
                     </div>
                  </>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsOpen && selectedBonus && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={closeModal}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bonus-detail-title"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-[#0f1523] border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 p-4 sm:p-6 border-b border-white/5 flex items-center justify-between gap-3 bg-[#0f1523]/95 backdrop-blur-xl">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-base sm:text-lg font-black text-white" id="bonus-detail-title">{selectedBonus.promoTitle}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold">
                    {selectedBonus.platformBonusDefinitionId ? `Platform ID: ${selectedBonus.platformBonusDefinitionId}` : ''}
                    {selectedBonus.backofficeName ? ` • Backoffice: ${selectedBonus.backofficeName}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeModal} aria-label={lobbyExtraText(pageContent, 'detailCloseLabel', 'Detayları kapat')} className="text-zinc-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg p-1">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
                  <div className="lg:col-span-1 flex items-center justify-center">
                    {selectedBonus.image ? (
                      <div className="relative w-full h-56 rounded-3xl overflow-hidden border border-white/10 group bg-black/40 flex items-center justify-center">
                        <img
                          src={selectedBonus.image}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                            const next = (e.target as any).nextElementSibling;
                            if (next) next.classList.remove('hidden');
                          }}
                        />
                        <div className="absolute inset-0 hidden items-center justify-center">
                          <BonusPlaceholder
                             size={180}
                             tone={'amber'}
                             className="bg-transparent border-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-56 rounded-3xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                        <BonusPlaceholder
                           size={180}
                           tone={'amber'}
                           className="bg-transparent border-none"
                        />
                      </div>
                    )}
                  </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(selectedBonus.tags ?? []).map((t) => (
                      <span key={t} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-zinc-300">
                        {t}
                      </span>
                    ))}
                  </div>

                  {selectedBonus.detailHtml ? (
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                      <div dangerouslySetInnerHTML={{ __html: selectedBonus.detailHtml }} />
                    </div>
                  ) : selectedBonus.rules?.conditions?.length ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{lobbyExtraText(pageContent, 'conditionsTitle', 'Koşullar')}</p>
                      <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                        {selectedBonus.rules.conditions.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 font-medium">{lobbyExtraText(pageContent, 'detailEmptyText', 'Detay bulunamadı.')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
