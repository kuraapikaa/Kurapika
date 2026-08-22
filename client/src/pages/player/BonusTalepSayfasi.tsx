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
  Send,
  AlertCircle,
} from 'lucide-react';
import { bonusPanelApi, dashboardApi, adminApi, gamesApi } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { BonusPlaceholder } from '@/components/ui/BonusPlaceholder';
import { LobbyPageShell, LobbyCard } from '@/components/player/LobbyPageShell';
import { useLobbyPageTheme, hexToRgba } from '@/lib/lobbyTheme';
import { lobbyExtraLines, lobbyExtraText, renderLobbyTemplate } from '@/lib/lobbyContent';
import { friendlyBonusEligibilityMessage } from '@/lib/bonusEligibilityMessages';
import { GENEL_RED_METNI, redOzeti, type RedSebebi } from '@/lib/bonusRedSebepleri';
import { useOtomatikOturum } from '@/lib/useParentUsername';

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

function TelegramBonusCard({ username }: { username: string }) {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ['telegram-bonus-status', username],
    queryFn: () => gamesApi.telegramBonusStatus(),
    enabled: Boolean(username),
    staleTime: 15 * 1000,
  });

  const verifyMutation = useMutation({
    mutationFn: () => gamesApi.verifyTelegramBonus(),
    onSuccess: (res) => {
      if (res?.ok) {
        queryClient.invalidateQueries({ queryKey: ['telegram-bonus-status', username] });
      }
    },
  });

  if (!username || isLoading) return null;
  const data = status?.data;
  if (!data?.enabled) return null;

  return (
    <div className="cam flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between md:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--lobby-primary,#e7c574)]/15 text-[color:var(--lobby-accent,#5fd6a7)]">
          <Send size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-black text-[color:var(--lobby-text,#f3ecdd)]">Telegram Bonusu</h3>
          <p className="text-[11px] font-medium leading-4 text-slate-400">
            {data.claimed
              ? 'Bonusunuzu aldınız, teşekkürler!'
              : data.isLinked
                ? `${data.channelUsername || 'Kanala'} katılıp doğrulayın, bonusunuz anında tanımlansın.`
                : 'Telegram hesabınızı bağlayın, ardından kanala katılıp doğrulayın.'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {data.claimed ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300">
            <CheckCircle2 size={13} /> Alındı
          </span>
        ) : !data.isLinked ? (
          <a
            href={data.linkUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[color:var(--lobby-primary,#e7c574)] px-3.5 text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--lobby-text,#f3ecdd)] transition hover:opacity-90"
          >
            <Send size={13} /> Hesabı Bağla
          </a>
        ) : (
          <button
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[color:var(--lobby-primary,#e7c574)] px-3.5 text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--lobby-text,#f3ecdd)] transition hover:opacity-90 disabled:opacity-60"
          >
            {verifyMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
            Doğrula ve Bonusu Al
          </button>
        )}
      </div>
      {verifyMutation.data && !verifyMutation.data.ok && (
        <p className="basis-full text-[11px] font-bold text-amber-400">{verifyMutation.data.message}</p>
      )}
    </div>
  );
}

export function BonusTalepSayfasi() {
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('bonus');
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
  const { username: ustPencereKullanici, bekleniyor: kimlikBekleniyorHam } = useOtomatikOturum();
  // Elimizde herhangi bir ad varken "bekleniyor" göstermenin anlamı yok.
  const kimlikBekleniyor = kimlikBekleniyorHam && !username;

  const [playerData, setPlayerData] = useState<any>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * Reddin GERÇEK sebepleri.
   *
   * Sunucu talep reddedildiğinde tam kontrol listesini yanıtın içinde
   * gönderiyor; istemci bunu okumayıp iki hazır cümleden birini
   * gösteriyordu. Oyuncu neden reddedildiğini öğrenemeyince ne
   * yapacağını da bilemiyordu.
   */
  const [submitReasons, setSubmitReasons] = useState<RedSebebi[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory(allCategory);
    }
  }, [allCategory, categories, selectedCategory]);

  // Oturum kontrolü: önce panelin kendi oturumu, yoksa kayıtlı ad.
  // Ana siteden gelen kimlik (useParentUsername) bunların ikisini de ezer.
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

  // Ana sitedeki oturumdan gelen kullanıcı adı en güvenilir kaynak.
  useEffect(() => {
    if (ustPencereKullanici) setUsername(ustPencereKullanici);
  }, [ustPencereKullanici]);

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
    // Eğer session varsa username'i sıfırlama. Ana siteden kimlik geldiyse
    // panel oturumu olmasa da temizleme: kullanıcı adı artık elle girilmiyor,
    // sıfırlarsak oyuncunun bonus talep etmesi imkânsız hale gelir.
    bonusPanelApi.me().then(res => {
       if (res.ok) {
          setUsername(res.login);
       } else if (ustPencereKullanici) {
          setUsername(ustPencereKullanici);
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
    setSubmitReasons([]);
    setSubmitSuccess(null);
    try {
      const res = await adminApi.chargeBonus({ ClientId: playerData.account.id, BonusId: selectedBonus.backofficeId, AssignmentValues: selectedBonus.rules?.assignmentValues ?? {} });
      if ((res as any)?.HasError) {
        // Yanıtın içindeki kontrol listesi okunuyor; sebep çıkarılamazsa
        // güvenli genel metne düşülüyor (sunucu bazen gerçekten teknik
        // bir hata döndürüyor ve o durumda "koşulu tamamlayın" demek
        // yanlış yönlendirme olurdu).
        const ozet = redOzeti(res);
        setSubmitError(ozet.metin);
        setSubmitReasons(ozet.sebepler);
      } else {
        setSubmitSuccess(renderLobbyTemplate(pageContent.successDescription, { bonus: selectedBonus.promoTitle }));
      }
    } catch {
      setSubmitError(GENEL_RED_METNI);
      setSubmitReasons([]);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper functions for styling

  // Bakim modu: lobideki karti gizlemek (quickAccess enabled=false) yalnizca
  // navigasyonu gizler, oyuncu sayfaya dogrudan URL ile hala ulasabilir. Bu
  // bayrak sayfanin KENDISINI kapatir — bonus listesi, sorgular ve modallar
  // hic calismaz, yalnizca "kapali" karti gosterilir.
  if (pageContent.maintenanceMode) {
    return (
      <LobbyPageShell
        active="bonus"
        palette={palette}
        rootStyle={rootStyle}
        backgroundStyle={backgroundStyle}
        eyebrow={pageContent.eyebrow}
        title={pageContent.title}
        subtitle={pageContent.subtitle}
        wide
      >
        <LobbyCard className="py-16 text-center">
          <Gift className="mx-auto mb-3 opacity-20" size={36} style={{ color: palette.accentColor }} />
          <p className="text-base font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.unavailableTitle}</p>
          {pageContent.unavailableDescription && (
            <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-[color:var(--lobby-muted,#8f8674)]">
              {pageContent.unavailableDescription}
            </p>
          )}
        </LobbyCard>
      </LobbyPageShell>
    );
  }

  return (
    <LobbyPageShell
      active="bonus"
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow={pageContent.eyebrow}
      title={pageContent.title}
      subtitle={pageContent.subtitle}
      wide
      aside={
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{
            borderColor: hexToRgba(palette.accentColor, 0.24),
            backgroundColor: hexToRgba(palette.accentColor, 0.12),
            color: palette.accentColor,
          }}
        >
          <Crown size={20} />
        </span>
      }
      toolbar={
        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'h-8 rounded-lg border px-3 text-[10px] font-black uppercase leading-none tracking-[0.06em] transition',
                  isActive ? 'text-[color:var(--lobby-text,#f3ecdd)]' : 'border-[rgba(243,236,221,0.07)] bg-[rgba(243,236,221,0.04)] text-[color:var(--lobby-muted,#8f8674)] hover:bg-[rgba(243,236,221,0.08)] hover:text-[color:var(--lobby-text,#f3ecdd)]'
                )}
                style={isActive ? {
                  borderColor: hexToRgba(palette.accentColor, 0.35),
                  backgroundColor: hexToRgba(palette.accentColor, 0.14),
                  color: palette.accentColor,
                } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      }
    >
      <TelegramBonusCard username={debouncedUsername} />

      {promosLoading && (
        <LobbyCard className="flex min-h-[180px] flex-col items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={24} style={{ color: palette.accentColor }} />
          <span className="text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]">{pageContent.loadingText}</span>
        </LobbyCard>
      )}

      {!promosLoading && filteredBonuses.length === 0 && (
        <LobbyCard className="py-12 text-center">
          <Gift className="mx-auto mb-2 opacity-20" size={32} />
          <p className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.emptyTitle}</p>
          {pageContent.emptyDescription && (
            <p className="mt-1 text-[12px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.emptyDescription}</p>
          )}
        </LobbyCard>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredBonuses.map(bonus => {
          const isClosed = bonus.backofficeId == null;

          // Başlıktaki öne çıkan sayı (ör. %25 / 250₺) kart görselinde vurgulanır.
          const bigNumMatch = bonus.promoTitle.match(/(%\d+|\d+%|\d+₺|\d+ TL)/i);
          const bigNum = bigNumMatch ? bigNumMatch[1] : (bonus.tags.find((t: string) => t.includes('%')) || '');

          const primaryTag = bonus.tags[0] || lobbyExtraText(pageContent, 'genericTag', 'Genel Bonus');
          const cardDescription = renderLobbyTemplate(
            lobbyExtraText(pageContent, 'cardDescriptionTemplate', '{bonus}! Şansınızı ayrıcalıklarla deneyin, kazanma şansınızı katlayın. Eğlenceye hemen katılın.'),
            { bonus: bonus.promoTitle }
          );

          return (
            <article
              key={bonus.promoTitle}
              className="cam cam-tiklanabilir group flex flex-col overflow-hidden"
            >
              {/*
                GÖRSEL ALANI 692×336.
                Sabit piksel değil ORAN kullanılıyor: 692px genişlik dar
                ekranda taşardı. `aspect-ratio` ile kart hangi genişliğe
                düşerse düşsün görsel tam 692:336 oranını korur, yani
                yüklenen artwork hiçbir kırpma olmadan oturur.

                Önceden alan `h-[108px]` ve görsel yalnızca sağ YARIDA
                (`w-1/2`) duruyordu; 692×336 gibi geniş bir görselin büyük
                kısmı kırpılıyordu. Artık tam genişlikte.
              */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: '692 / 336',
                  background: `linear-gradient(135deg, ${hexToRgba(palette.primaryColor, 0.22)}, ${hexToRgba(palette.backgroundColor, 0.9)})`,
                }}
              >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                  {bonus.image ? (
                    <img
                      src={bonus.image}
                      alt=""
                      width={692}
                      height={336}
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                        const next = (e.target as any).nextElementSibling;
                        if (next) next.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={cn('absolute inset-0 items-center justify-center', bonus.image ? 'hidden' : 'flex')}
                  >
                    <BonusPlaceholder size={92} tone="amber" className="border-none bg-transparent shadow-none" />
                  </div>
                </div>

                {/*
                  Okunabilirlik perdesi: başlık ve rozet artık görselin
                  ÜSTÜNDE duruyor. Yalnızca görsel varsa çiziliyor —
                  yoksa gradyan zemini gereksiz yere koyulaştırırdı.
                */}
                {bonus.image ? (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `linear-gradient(90deg, ${hexToRgba(palette.backgroundColor, 0.86)} 0%, ${hexToRgba(palette.backgroundColor, 0.45)} 42%, ${hexToRgba(palette.backgroundColor, 0)} 72%)`,
                    }}
                  />
                ) : null}

                <span
                  className="absolute left-2.5 top-2.5 z-10 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]"
                  style={{
                    borderColor: hexToRgba(palette.accentColor, 0.3),
                    backgroundColor: hexToRgba(palette.accentColor, 0.14),
                    color: palette.accentColor,
                  }}
                >
                  {primaryTag}
                </span>

                <div className="absolute bottom-2.5 left-2.5 z-10">
                  {bigNum && (
                    <span
                      className="block text-2xl font-black leading-none tracking-tighter drop-shadow"
                      style={{ color: palette.accentColor }}
                    >
                      {bigNum}
                    </span>
                  )}
                  <span className="mt-0.5 line-clamp-2 block max-w-[130px] text-[11px] font-black uppercase leading-tight text-[color:var(--lobby-text,#f3ecdd)] drop-shadow">
                    {bonus.promoTitle.replace(bigNum, '').trim()}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 text-[12px] font-black leading-tight text-[color:var(--lobby-text,#f3ecdd)]">{bonus.promoTitle}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-[11px] font-medium leading-4 text-[color:var(--lobby-muted,#8f8674)]">{cardDescription}</p>

                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(bonus)}
                    aria-label={`${bonus.promoTitle} ${lobbyExtraText(pageContent, 'detailTitleSuffix', 'detaylarını görüntüle')}`}
                    className="cam-kontrol cam-tiklanabilir dokunma flex-1 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]"
                  >
                    {pageContent.secondaryButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenModal(bonus)}
                    disabled={isClosed}
                    aria-label={isClosed
                      ? `${bonus.promoTitle} ${lobbyExtraText(pageContent, 'closedAriaSuffix', 'şu an kapalı')}`
                      : `${bonus.promoTitle} ${lobbyExtraText(pageContent, 'requestAriaSuffix', 'talep et')}`}
                    className={cn(
                      'flex h-9 flex-1 items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-[0.08em] transition',
                      isClosed && 'cursor-not-allowed bg-[rgba(243,236,221,0.04)] text-[color:var(--lobby-muted,#8f8674)]'
                    )}
                    style={isClosed ? undefined : {
                      background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                      color: '#fff',
                      boxShadow: `0 6px 18px ${hexToRgba(palette.primaryColor, 0.24)}`,
                    }}
                  >
                    {isClosed ? lobbyExtraText(pageContent, 'closedButton', 'Kapalı') : pageContent.primaryButton}
                    {!isClosed && <ChevronRight size={12} />}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bonus Request Modal */}
      <AnimatePresence>
        {isModalOpen && selectedBonus && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80"
               onClick={closeModal}
            />

            <motion.div
               role="dialog"
               aria-modal="true"
               aria-labelledby="bonus-modal-title"
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: -20 }}
               className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-hidden overflow-y-auto rounded-t-2xl border border-[rgba(243,236,221,0.10)] bg-[#0d1119] shadow-2xl sm:rounded-xl"
            >
               {submitSuccess ? (
                  <div className="p-5 text-center">
                     <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                        <CheckCircle2 size={22} className="text-emerald-400" />
                     </div>
                     <h2 className="mb-1.5 text-base font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.successTitle}</h2>
                     <p className="mb-4 text-[12px] font-bold text-emerald-300">{submitSuccess}</p>

                     <button
                        onClick={closeModal}
                        className="cam-kontrol cam-tiklanabilir dokunma w-full text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-text,#f3ecdd)]"
                     >
                        {pageContent.successButton}
                     </button>
                  </div>
               ) : (
                  <>
                     <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgba(243,236,221,0.05)] bg-[#0d1119]/95 p-3.5">
                        <h3 className="min-w-0 truncate text-[13px] font-black text-[color:var(--lobby-text,#f3ecdd)]" id="bonus-modal-title">{renderLobbyTemplate(pageContent.formTitle, { bonus: selectedBonus.promoTitle })}</h3>
                        <button type="button" onClick={closeModal} aria-label={lobbyExtraText(pageContent, 'modalCloseLabel', 'Modalı kapat')} className="text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg p-1">
                           <X size={20} aria-hidden="true" />
                        </button>
                     </div>

                     <div className="space-y-3.5 p-3.5">
                        {pageContent.formDescription && (
                           <p className="text-sm font-medium leading-6 text-[color:var(--lobby-muted,#8f8674)]">{pageContent.formDescription}</p>
                        )}
                        {/* Kullanıcı adı artık elle yazılmıyor: oturum ana siteden
                            (postMessage ile) veya panel oturumundan geliyor. */}
                        <div>
                           <span className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                              <User size={14} aria-hidden="true" /> {pageContent.usernameLabel}
                           </span>
                           {username ? (
                              <div
                                 data-testid="bonus-modal-username"
                                 className="flex h-11 w-full items-center rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-3 text-[13px] font-bold text-[color:var(--lobby-text,#f3ecdd)]"
                              >
                                 {username}
                              </div>
                           ) : kimlikBekleniyor ? (
                              <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-3 text-[13px] font-bold text-[color:var(--lobby-muted,#8f8674)]">
                                 <Loader2 className="animate-spin" size={16} />
                                 {lobbyExtraText(pageContent, 'identityLoadingText', 'Hesabınız alınıyor...')}
                              </div>
                           ) : (
                              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                                 <AlertCircle size={20} className="shrink-0" />
                                 {lobbyExtraText(
                                    pageContent,
                                    'loginRequiredText',
                                    'Bonus talebi için siteye giriş yapmanız gerekiyor.'
                                 )}
                              </div>
                           )}
                        </div>

                        {/* Status Area */}
                        {debouncedUsername ? (
                           playerLoading ? (
                              <div className="cam-kontrol flex items-center justify-center gap-2 py-4 text-[12px] font-bold text-[color:var(--lobby-accent,#5fd6a7)]">
                                 <Loader2 className="animate-spin" size={18} /> {lobbyExtraText(pageContent, 'checkingText', 'Hesap kontrol ediliyor...')}
                              </div>
                           ) : playerData?.error ? (
                              <div className="flex items-center gap-3 text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 font-bold text-sm">
                                 <XCircle size={20} className="shrink-0" />
                                 {playerData.error}
                              </div>
                           ) : playerData?.account ? (
                              <div className="space-y-4">
                                 <div className="flex flex-col gap-1 p-4 bg-black/40 rounded-xl border border-[rgba(243,236,221,0.05)]">
                                    <div className="flex items-center justify-between text-[color:var(--lobby-muted,#8f8674)] text-xs font-bold uppercase">
                                       <span>{lobbyExtraText(pageContent, 'accountStatusLabel', 'Hesap Durumu')}</span>
                                       <span>{lobbyExtraText(pageContent, 'balanceLabel', 'Bakiye')}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                       <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                                          <ShieldCheck size={16} /> {lobbyExtraText(pageContent, 'verifiedText', 'Doğrulandı')}
                                       </span>
                                       <span className="font-black text-[color:var(--lobby-text,#f3ecdd)]">{playerData.account.balance?.toLocaleString('tr-TR')} ₺</span>
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
                                                   <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[rgba(243,236,221,0.06)] bg-black/25 p-3">
                                                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                                                      <div className="flex flex-col gap-1">
                                                         <span className="text-[11px] font-bold text-[color:var(--lobby-text,#f3ecdd)]">{friendly.title}</span>
                                                         <span className="text-[11px] font-medium leading-5 text-[color:var(--lobby-muted,#8f8674)]">{friendly.message}</span>
                                                      </div>
                                                   </div>
                                                );
                                             })}
                                          </div>
                                       )}
                                    </div>
                                 )}

                                 {submitError && (
                                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                                       <p className="font-bold">{submitError}</p>
                                       {submitReasons.length > 0 && (
                                          <ul className="mt-2 space-y-1.5">
                                             {submitReasons.map((sebep) => (
                                                <li key={sebep.id} className="leading-5">
                                                   <span className="font-bold">{sebep.title}:</span>{' '}
                                                   <span className="font-medium opacity-90">{sebep.message}</span>
                                                </li>
                                             ))}
                                          </ul>
                                       )}
                                    </div>
                                 )}

                                 <button
                                    onClick={handleSubmit}
                                    disabled={submitting || (playerData.specificBonusCheck && !playerData.specificBonusCheck.overallOk)}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--lobby-text,#f3ecdd)] transition active:scale-[0.99] disabled:opacity-50 disabled:grayscale"
                                    style={{ background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`, boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}` }}
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
                           <div className="flex items-center justify-center gap-2 text-[color:var(--lobby-muted,#8f8674)] text-sm font-bold py-6 px-4 text-center bg-black/20 rounded-xl border border-[rgba(243,236,221,0.05)]">
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
              className="absolute inset-0 bg-black/80"
              onClick={closeModal}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bonus-detail-title"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-hidden overflow-y-auto rounded-t-2xl border border-[rgba(243,236,221,0.10)] bg-[#0d1119] shadow-2xl sm:rounded-xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgba(243,236,221,0.05)] bg-[#0d1119]/95 p-3.5">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-base sm:text-lg font-black text-[color:var(--lobby-text,#f3ecdd)]" id="bonus-detail-title">{selectedBonus.promoTitle}</h3>
                  <p className="text-[10px] text-[color:var(--lobby-muted,#8f8674)] font-bold">
                    {selectedBonus.platformBonusDefinitionId ? `Platform ID: ${selectedBonus.platformBonusDefinitionId}` : ''}
                    {selectedBonus.backofficeName ? ` • Backoffice: ${selectedBonus.backofficeName}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeModal} aria-label={lobbyExtraText(pageContent, 'detailCloseLabel', 'Detayları kapat')} className="text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg p-1">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
                  <div className="lg:col-span-1 flex items-center justify-center">
                    {selectedBonus.image ? (
                      <div className="relative w-full h-56 rounded-[20px] overflow-hidden border border-[rgba(243,236,221,0.10)] group bg-black/40 flex items-center justify-center">
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
                      <div className="w-full h-56 rounded-[20px] bg-black/40 border border-[rgba(243,236,221,0.10)] flex items-center justify-center overflow-hidden">
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
                      <span key={t} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[rgba(243,236,221,0.05)] border border-[rgba(243,236,221,0.10)] text-[color:var(--lobby-text,#f3ecdd)]">
                        {t}
                      </span>
                    ))}
                  </div>

                  {selectedBonus.detailHtml ? (
                    <div className="prose prose-invert prose-sm max-w-none text-[color:var(--lobby-text,#f3ecdd)]">
                      <div dangerouslySetInnerHTML={{ __html: selectedBonus.detailHtml }} />
                    </div>
                  ) : selectedBonus.rules?.conditions?.length ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest">{lobbyExtraText(pageContent, 'conditionsTitle', 'Koşullar')}</p>
                      <ul className="list-disc pl-5 text-sm text-[color:var(--lobby-text,#f3ecdd)] space-y-1">
                        {selectedBonus.rules.conditions.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-[color:var(--lobby-muted,#8f8674)] font-medium">{lobbyExtraText(pageContent, 'detailEmptyText', 'Detay bulunamadı.')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LobbyPageShell>
  );
}
