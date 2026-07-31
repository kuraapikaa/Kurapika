import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getBackofficeToken } from '../lib/authStore.js';
import { resolveTenantKeyForRequest, safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { isLynonConfigured, lynonAssignCampaignToPlayer, lynonBuildBonusEligibilitySnapshot, lynonCreditPlayerMainAccount, lynonFindPlayerByLogin, lynonPlayerActivity } from '../services/lynonBackofficeService.js';
import { oyuncuAktivitesi } from '../services/oyuncuRaporService.js';
import { getChatMember, isTelegramConfigured, sendTelegramMessage } from '../services/telegramService.js';
import { ensureTelegramLinkDir, getLinkedTelegramUserId, linkTelegramAccount } from '../services/telegramLinkService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GAMES_DATA_FILE = path.join(__dirname, '..', 'data', 'game-settings.json');
const WHEEL_CODES_FILE = path.join(__dirname, '..', 'data', 'wheel-codes.json');
const TENANT_GAMES_DIR = path.join(__dirname, '..', 'data', 'game-settings');
const TENANT_WHEEL_CODES_DIR = path.join(__dirname, '..', 'data', 'wheel-codes');
const TENANT_WHEEL_CLAIMS_DIR = path.join(__dirname, '..', 'data', 'wheel-claims');
const TENANT_PREDICTIONS_DIR = path.join(__dirname, '..', 'data', 'prediction-entries');
const TENANT_PREDICTION_SETTLEMENTS_DIR = path.join(__dirname, '..', 'data', 'prediction-settlements');
const TENANT_ENGAGEMENT_DIR = path.join(__dirname, '..', 'data', 'engagement');
const TENANT_TELEGRAM_CLAIMS_DIR = path.join(__dirname, '..', 'data', 'telegram-claims');
const TURKEY_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const PLAYER_ACTIVITY_CACHE_TTL_MS = 2 * 60 * 1000;
const playerActivityCache = new Map<string, { expiresAt: number; value: Promise<any> }>();
const predictionSettlementLocks = new Set<string>();
const wheelClaimLocks = new Set<string>();
const teamLogoCache = new Map<string, { expiresAt: number; imageUrl: string | null }>();
const TEAM_LOGO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Takım adına göre Wikipedia'nın (tr, sonra en) sayfa görselini arar; bulamazsa null döner. */
async function fetchWikipediaTeamLogo(teamName: string): Promise<string | null> {
  const cacheKey = teamName.trim().toLocaleLowerCase('tr-TR');
  const cached = teamLogoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.imageUrl;

  const lookup = async (lang: 'tr' | 'en'): Promise<string | null> => {
    const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: teamName,
      gsrlimit: '1',
      prop: 'pageimages',
      piprop: 'original',
      origin: '*',
    }).toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body: any = await res.json();
    const pages = body?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    return page?.original?.source ?? null;
  };

  const imageUrl = (await lookup('tr')) ?? (await lookup('en'));
  teamLogoCache.set(cacheKey, { expiresAt: Date.now() + TEAM_LOGO_CACHE_TTL_MS, imageUrl });
  return imageUrl;
}

// Ensure data directory exists
if (!fs.existsSync(path.dirname(GAMES_DATA_FILE))) {
  fs.mkdirSync(path.dirname(GAMES_DATA_FILE), { recursive: true });
}

const DEFAULT_GAME_SETTINGS = {
  lobby: {
    themePreset: 'ocean',
    primaryColor: '#3b82f6',
    secondaryColor: '#1d4ed8',
    accentColor: '#5eead4',
    backgroundColor: '#060911',
    surfaceColor: '#0d1119',
    textColor: '#f1f5f9',
    mutedTextColor: '#7dd3fc',
    backgroundImageUrl: '',
    backgroundOverlay: 72,
    banner: {
      enabled: false,
      imageUrl: '',
      title: 'Sezon fırsatları başladı',
      subtitle: 'Günlük görevler ve sezon kartı ödülleri yayında.',
      ctaLabel: 'Hemen katıl',
      linkUrl: '/gorevler'
    },
    quickAccess: [
      { id: 'bonus', label: 'Bonus Talep', desc: 'Kampanya ve freespin', to: '/bonus-talep', icon: 'gift', accentColor: '#fb7185', enabled: true },
      { id: 'wheel', label: 'Şans Çarkı', desc: 'Çevir, ödül kazan', to: '/cark', icon: 'zap', accentColor: '#d4af37', enabled: true },
      { id: 'scratch', label: 'Kazı Kazan', desc: 'Kartını kazı', to: '/kazi-kazan', icon: 'sparkles', accentColor: '#f4d36f', enabled: true },
      { id: 'prediction', label: 'Narcos Skor Tahmin', desc: 'Maç skoru bil', to: '/skor-tahmin', icon: 'goal', accentColor: '#6ee7b7', enabled: true },
      { id: 'daily-tasks', label: 'Günlük Görevler', desc: 'API ilerleme', to: '/gorevler', icon: 'list-checks', accentColor: '#7dd3fc', enabled: true },      { id: 'tournament', label: 'Turnuva', desc: 'Sıralamaya gir', to: '/turnuva/gunluk', icon: 'trophy', accentColor: '#facc15', enabled: true },
      { id: 'loyalty', label: 'Sadakat', desc: 'XP ve ödüller', to: '/sadakat', icon: 'star', accentColor: '#facc15', enabled: true },
      { id: 'millionaires', label: 'Milyonerler', desc: 'Büyük kazançlar', to: '/milyonerler', icon: 'crown', accentColor: '#facc15', enabled: true },
      { id: 'vip', label: 'VIP', desc: 'Özel üyelik', to: '/vip', icon: 'shield', accentColor: '#d4af37', enabled: true },
      { id: 'partner', label: 'İş Birliği', desc: 'Partner ol', to: '/ortaklik', icon: 'handshake', accentColor: '#7dd3fc', enabled: true },
      { id: 'call-me', label: 'Aranma Talep', desc: '7/24 destek', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true }
    ],
    pages: {
      bonus: {
        label: 'Bonus Talep',
        path: '/bonus-talep',
        eyebrow: 'Bonus Merkezi',
        title: 'Bonus Talep',
        subtitle: 'Size uygun kampanyaları seçin, hesabınızı doğrulayın ve talebinizi gönderin.',
        primaryButton: 'TALEP ET',
        secondaryButton: 'Detaylar',
        emptyTitle: 'Bonus bulunamadı.',
        emptyDescription: 'Şu anda bu kategori için aktif bonus bulunmuyor.',
        loadingText: 'Bonuslar yükleniyor...',
        unavailableTitle: 'Form Geçici Olarak Kapalı',
        unavailableDescription: 'Bonus talepleri şu anda geçici olarak kapalı.',
        successTitle: 'İşlem Başarılı!',
        successDescription: 'Tebrikler! "{bonus}" başarıyla tanımlandı.',
        successButton: 'Kapat',
        formTitle: '{bonus} Talep Et',
        formDescription: 'Bonusu tanımlamak için kullanıcı adınızı doğrulayın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınızı girin',
        submitButton: 'TALEBİ ONAYLA',
        extra: {
          categories: ['Tümü', 'Yatırım Bonusları', 'Kayıp Bonusları', 'Hediye Bonuslar', 'Spor'],
          cardDescriptionTemplate: '{bonus}! Şansınızı ayrıcalıklarla deneyin, kazanma şansınızı katlayın. Eğlenceye hemen katılın.',
          closedButton: 'KAPALI',
          checkingText: 'Hesap kontrol ediliyor...',
          accountStatusLabel: 'Hesap Durumu',
          balanceLabel: 'Bakiye',
          verifiedText: 'Doğrulandı',
          rulesOkText: 'Tüm kurallar sağlanıyor. Talep edebilirsiniz.',
          rulesFailText: 'Seçili bonus için sistem kurallarını sağlamıyorsunuz.',
          ruleViolationText: 'Kural ihlali tespit edildi.',
          submitLoading: 'Talep Gönderiliyor...',
          submitBlocked: 'KURALLARI SAĞLAMIYORSUNUZ',
          usernamePrompt: 'Onaylamak için kullanıcı adınızı yazın.',
          conditionsTitle: 'Koşullar',
          detailEmptyText: 'Detay bulunamadı.'
        }
      },
      wheel: {
        label: 'Şans Çarkı',
        path: '/cark',
        eyebrow: 'Şans Oyunu',
        title: 'Şans Çarkı',
        subtitle: 'Kullanıcı adınızı girin ve çarkı çevirin.',
        primaryButton: 'ÇEVİR',
        secondaryButton: 'Devam Et',
        emptyTitle: 'Maalesef Boş!',
        emptyDescription: 'Bu turda ödül çıkmadı.',
        loadingText: 'Çark dönüyor...',
        unavailableTitle: 'Çark Geçici Olarak Kapalı',
        unavailableDescription: 'Şans çarkı şu anda kullanılamıyor.',
        successTitle: 'Tebrikler!',
        successDescription: 'Bonusunuz hesabınıza eklendi!',
        successButton: 'Devam Et',
        formTitle: 'Oyuncu doğrulama',
        formDescription: 'Çarkı çevirmek için kullanıcı adınızı doğrulayın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Devam Et',
        extra: { codePlaceholder: 'Varsa Çark Kodunuz', bonusFailedText: 'Otomatik ekleme başarısız.' }
      },
      scratch: {
        label: 'Kazı Kazan',
        path: '/kazi-kazan',
        eyebrow: 'Şans Oyunu',
        title: 'Kazı Kazan',
        subtitle: 'Kartı kazıyın, 3 aynı sembolü bulun!',
        primaryButton: 'Tekrar Dene',
        secondaryButton: 'Devam Et',
        emptyTitle: 'Denemeye Devam',
        emptyDescription: 'Bu kartta ödül bulunamadı.',
        loadingText: 'Kart hazırlanıyor...',
        unavailableTitle: 'Kazı Kazan Kapalı',
        unavailableDescription: 'Kazı kazan oyunu şu anda kullanılamıyor.',
        successTitle: 'Tebrikler!',
        successDescription: 'Bonusunuz hesabınıza eklendi!',
        successButton: 'Tekrar Dene',
        formTitle: 'Oyuncu doğrulama',
        formDescription: 'Kartı kazımak için kullanıcı adınızı doğrulayın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Devam Et',
        extra: { progressTemplate: 'Bütün kareleri kazıyın ({count}/9)', bonusFailedText: 'Ekleme başarısız.' }
      },
      prediction: {
        label: 'Narcos Skor Tahmin',
        path: '/skor-tahmin',
        eyebrow: 'Tahmin Ligi',
        title: 'Narcos Skor Tahmin',
        subtitle: 'Maç skorunu bil, ligde yüksel ve ödül fırsatlarını yakala.',
        primaryButton: 'Tahmini Gönder',
        secondaryButton: 'Giriş Yap',
        emptyTitle: 'Tahmin maçı bulunamadı.',
        emptyDescription: 'Yeni maçlar eklendiğinde burada görünecek.',
        loadingText: 'Tahmin ligi yükleniyor...',
        unavailableTitle: 'Tahmin Kapalı',
        unavailableDescription: 'Bu maç için tahmin süresi kapandı.',
        successTitle: 'Tahminin kaydedildi.',
        successDescription: 'Sonuçlar açıklandığında puanın güncellenecek.',
        successButton: 'Tamam',
        formTitle: 'Oyuncu doğrulama',
        formDescription: 'Tahmin göndermek için kullanıcı adınızı doğrulayın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Giriş Yap',
        extra: { matchesTitle: 'Tahmin maçları' }
      },
      'daily-tasks': {
        label: 'Günlük Görevler',
        path: '/gorevler',
        eyebrow: 'Görev Merkezi',
        title: 'Günlük Görevler',
        subtitle: 'Günlük aktiviteleri tamamlayın, XP ve ödülleri toplayın.',
        primaryButton: 'Bonuslara Git',
        secondaryButton: 'Çıkış',
        emptyTitle: 'Görev bulunamadı.',
        emptyDescription: 'Yeni görevler hazırlandığında burada görünecek.',
        loadingText: 'Görevler yükleniyor...',
        unavailableTitle: 'Görevler yüklenemedi.',
        unavailableDescription: 'Lütfen daha sonra tekrar deneyin.',
        successTitle: 'Ödül alındı.',
        successDescription: 'Görev ödülünüz hesabınıza işlendi.',
        successButton: 'Tamam',
        formTitle: 'Oyuncu doğrulama',
        formDescription: 'Görev ilerlemenizi okumak için giriş yapın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Giriş Yap',
        extra: { claimButton: 'Ödülü Al', claimedButton: 'Alındı', progressLabel: 'İlerleme' }
      },
      'battle-pass': {
        label: 'Sezon Kartı',
        path: '/sezon-karti',
        eyebrow: 'Sezon etkinliği',
        title: 'Sezon Kartı',
        subtitle: 'XP kazan, seviye atla ve sezon ödüllerini aç.',
        primaryButton: 'Görevlere Git',
        secondaryButton: 'Çıkış',
        emptyTitle: 'Sezon seviyesi bulunamadı.',
        emptyDescription: 'Sezon ödülleri hazırlandığında burada görünecek.',
        loadingText: 'Sezon kartı yükleniyor...',
        unavailableTitle: 'Sezon kartı yüklenemedi.',
        unavailableDescription: 'Lütfen daha sonra tekrar deneyin.',
        successTitle: 'Ödül alındı.',
        successDescription: 'Sezon ödülünüz hesabınıza işlendi.',
        successButton: 'Tamam',
        formTitle: 'Oyuncu doğrulama',
        formDescription: 'Sezon ilerlemenizi okumak için giriş yapın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Giriş Yap',
        extra: { freeTrack: 'Ücretsiz', premiumTrack: 'Premium', taskXpLabel: 'Görev', claimButton: 'Ödülü Al', claimedButton: 'Alındı' }
      },
      tournament: {
        label: 'Turnuva',
        path: '/turnuva/gunluk',
        eyebrow: 'Turnuva',
        title: 'Turnuva',
        subtitle: '{period} etabında kıyasıya rekabet başladı. Hemen oyna, ödülünü al!',
        primaryButton: 'Bonus Talep',
        secondaryButton: 'Lobiye Dön',
        emptyTitle: 'Sıralama henüz oluşmadı.',
        emptyDescription: 'Oyuncular skor aldıkça liste güncellenecek.',
        loadingText: 'Sıralama yükleniyor...',
        unavailableTitle: 'Turnuva yüklenemedi.',
        unavailableDescription: 'Lütfen daha sonra tekrar deneyin.',
        successTitle: 'Sıralamadasınız',
        successDescription: 'Skorunuz güncellendiğinde tabloya yansır.',
        successButton: 'Tamam',
        formTitle: 'Turnuva dönemi',
        formDescription: 'Günlük, haftalık veya aylık turnuva etabını seçin.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Katıl',
        extra: { liveLabel: 'Anlık', tournamentSuffix: 'TURNUVA', prizePoolTitle: 'ÖDÜL HAVUZU', updateLabel: 'GÜNCELLEME' }
      },
      loyalty: {
        label: 'Sadakat',
        path: '/sadakat',
        eyebrow: 'Sadakat',
        title: 'Sadakat Merkezi',
        subtitle: 'Sadakat puanlarınızı takip edin ve market ödüllerini açın.',
        primaryButton: 'Markete Git',
        secondaryButton: 'Lobiye Dön',
        emptyTitle: 'Henüz Eşyanız Yok',
        emptyDescription: 'Market ödüllerini açtığınızda burada görünecek.',
        loadingText: 'Sadakat merkezi yükleniyor...',
        unavailableTitle: 'Oturum açılmadı',
        unavailableDescription: 'Sadakat puanlarınızı görmek için lütfen giriş yapın.',
        successTitle: 'Ödül alındı.',
        successDescription: 'Sadakat ödülünüz işlendi.',
        successButton: 'Tamam',
        formTitle: 'Sadakat bölümleri',
        formDescription: 'Market ve envanter arasında geçiş yapın.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Giriş Yap',
        extra: { marketTab: 'Market', inventoryTab: 'Envanter' }
      },
      millionaires: {
        label: 'Milyonerler',
        path: '/milyonerler',
        eyebrow: 'Milyonerler',
        title: 'Büyük kazanç anları burada parlıyor',
        subtitle: 'En büyük kazançları, oyunları ve video tekrarlarını keşfedin.',
        primaryButton: 'Videoyu İzle',
        secondaryButton: 'Lobiye Dön',
        emptyTitle: 'Vitrin şu anda kapalı',
        emptyDescription: 'Kazanç vitrini açıldığında tekrar kontrol edin.',
        loadingText: 'Vitrin yükleniyor...',
        unavailableTitle: 'Vitrin şu anda kapalı',
        unavailableDescription: 'Kazanç vitrini geçici olarak kapalı.',
        successTitle: 'Video hazır',
        successDescription: 'Kazanç videosu açıldı.',
        successButton: 'Kapat',
        formTitle: 'Sosyal bağlantılar',
        formDescription: 'Büyük kazançları sosyal kanallarda takip edin.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Gönder',
        extra: { backButton: 'Lobiye Dön' }
      },
      vip: {
        label: 'VIP',
        path: '/vip',
        eyebrow: 'VIP Üyelik Programı',
        title: 'Ayrıcalıklı deneyim,\\nözel avantajlar',
        subtitle: 'Sadık oyuncularımıza özel VIP programıyla kazancını ve deneyimini üst seviyeye taşı.',
        primaryButton: 'VIP Başvurusu Yap',
        secondaryButton: 'Lobiye Dön',
        emptyTitle: 'Kademe bulunamadı.',
        emptyDescription: 'VIP kademeleri hazırlandığında burada görünecek.',
        loadingText: 'VIP sayfası yükleniyor...',
        unavailableTitle: 'VIP başvuruları kapalı',
        unavailableDescription: 'VIP başvuruları şu anda geçici olarak kapalı.',
        successTitle: 'Başvurunuz alındı!',
        successDescription: 'Ekibimiz en kısa sürede sizinle iletişime geçecek.',
        successButton: 'Lobiye Dön',
        formTitle: 'VIP başvurusu',
        formDescription: 'Bilgilerinizi bırakın, VIP ekibi sizinle iletişime geçsin.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adı *',
        submitButton: 'Başvuru Gönder',
        extra: { tiersTitle: 'Kademenizi seçin', faqTitle: 'Sık sorulan sorular', tiersButton: 'Seviyeleri gör', tierApplyButton: 'Bu seviyeye başvur' }
      },
      partner: {
        label: 'İş Birliği',
        path: '/ortaklik',
        eyebrow: 'Partner Programı',
        title: 'Ortaklık Başvurusu',
        subtitle: 'Yayıncı, affiliate veya iş ortağı başvurunuzu hızlıca iletin.',
        primaryButton: 'Başvuruyu Gönder',
        secondaryButton: 'Yeni Başvuru',
        emptyTitle: 'Form Geçici Olarak Kapalı',
        emptyDescription: 'Ortaklık başvuruları şu anda yöneticiler tarafından geçici olarak kapatıldı.',
        loadingText: 'Başvuru gönderiliyor...',
        unavailableTitle: 'Form Geçici Olarak Kapalı',
        unavailableDescription: 'Ortaklık başvuruları şu an için geçici olarak devre dışı bırakılmıştır.',
        successTitle: 'Başvurunuz Alındı!',
        successDescription: 'Ekibimiz başvurunuzu değerlendirecek ve kısa sürede dönüş yapacaktır.',
        successButton: 'Yeni Başvuru',
        formTitle: 'Ortaklık Başvurusu',
        formDescription: 'Kanal bilgilerinizi ve iletişim detayınızı paylaşın.',
        usernameLabel: 'İŞ BİRLİĞİ TÜRÜ',
        usernamePlaceholder: '@KullaniciAdi',
        submitButton: 'Başvuruyu Gönder',
        extra: { channelLabel: 'KANAL/SAYFA LİNKİ', messageLabel: 'MESAJ' }
      },
      'call-me': {
        label: 'Aranma Talep',
        path: '/beni-ara',
        eyebrow: 'Destek',
        title: 'Aranma Talebi',
        subtitle: 'Telefon numaranızı bırakın, destek ekibi size ulaşsın.',
        primaryButton: 'Talep Gönder',
        secondaryButton: 'Yeni Talep',
        emptyTitle: 'Form Geçici Olarak Kapalı',
        emptyDescription: 'Beni Ara talepleri şu anda yöneticiler tarafından geçici olarak kapatıldı.',
        loadingText: 'Talep gönderiliyor...',
        unavailableTitle: 'Form Geçici Olarak Kapalı',
        unavailableDescription: 'Beni Ara talepleri şu an için yöneticiler tarafından geçici olarak devre dışı bırakılmıştır. Lütfen daha sonra tekrar deneyiniz.',
        successTitle: 'Talebiniz Alındı!',
        successDescription: 'Destek ekibimiz en kısa sürede sizi arayacak.',
        successButton: 'Yeni Talep',
        formTitle: 'Aranma Talebi',
        formDescription: 'Ulaşılabilir telefon numaranızı girin.',
        usernameLabel: 'KULLANICI ADI',
        usernamePlaceholder: 'Kullanıcı adınız',
        submitButton: 'Talep Gönder',
        extra: { phoneLabel: 'TELEFON', phonePlaceholder: 'Örn: 05xx xxx xx xx', reasonLabel: 'KONU' }
      }
    },
    tabs: {
      games: {
        enabled: true,
        label: 'Hızlı Erişim',
        hint: 'Kısayollar',
        sectionTitle: 'Hızlı Erişim',
        actionText: '{count} kısayol'
      },
      tournaments: {
        enabled: true,
        label: 'Turnuva',
        hint: 'Sıralama',
        sectionTitle: 'Turnuvalar',
        actionText: 'Canlı etkinlik',
        rankPrefix: 'Popülerlik',
        prizeSuffix: '₺',
        cardDescription: 'Sıralamaya gir, ödül havuzunda yerini al.',
        cards: [
          { id: 'daily', label: 'Günlük', period: '24 saat', prizeFallback: '50.000', to: '/turnuva/gunluk', icon: 'zap', accentColor: '#facc15', enabled: true },
          { id: 'weekly', label: 'Haftalık', period: '7 gün', prizeFallback: '250.000', to: '/turnuva/haftalik', icon: 'star', accentColor: '#7dd3fc', enabled: true },
          { id: 'monthly', label: 'Aylık', period: '30 gün', prizeFallback: '500.000', to: '/turnuva/aylik', icon: 'trophy', accentColor: '#d4af37', enabled: true }
        ]
      },
      support: {
        enabled: true,
        label: 'Destek',
        hint: 'Yardım',
        sectionTitle: 'Destek',
        actionText: '7/24',
        searchPlaceholder: 'Oyun ara...',
        infoTitle: '7/24 destek',
        infoDescription: 'Mobilde hızlı yardım için hazır.',
        infoAccentColor: '#d4af37',
        cards: [
          { id: 'call', title: 'Sizi arayalım', desc: 'Destek için numaranızı bırakın.', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
          { id: 'partner', title: 'İş birliği', desc: 'Yayıncı ve reklam başvurusu.', to: '/ortaklik', icon: 'handshake', accentColor: '#facc15', enabled: true }
        ]
      }
    }
  },
  wheelAppearance: {
    rimColor: '#27272a',
    centerColor: '#27272a',
    pointerColor: '#ffffff',
    glowColor: '#d4af37',
    pageAccentColor: '#d4af37',
    borderWidth: 8,
    centerSize: 52,
    labelSize: 11,
    glowStrength: 0,
    glossy: true
  },
  wheelDailyLimit: 1,
  wheel: [
    { id: 'wheel-pass', label: 'Tekrar Dene', bgColor: '#111827', textColor: '#ffffff', probability: 97, type: 'none', bonusId: null, amount: 0, isLoss: true },
    { id: 'wheel-fs-sweet-100', label: '100 Freespin', detail: 'Sweet Bonanza · 1 ₺ spin', bgColor: '#b7791f', textColor: '#ffffff', probability: 0, type: 'bonus', rewardKind: 'freespin', bonusId: null, amount: 100, gameName: 'Sweet Bonanza', spinValue: 1, spinCount: 100, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-fs-gates-150', label: '150 Freespin', detail: 'Gates of Olympus · 1 ₺ spin', bgColor: '#7c3aed', textColor: '#ffffff', probability: 0, type: 'bonus', rewardKind: 'freespin', bonusId: null, amount: 150, gameName: 'Gates of Olympus', spinValue: 1, spinCount: 150, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-cash-150', label: '150 ₺ Nakit', detail: 'Çevrimsiz direkt bakiye', bgColor: '#166534', textColor: '#ffffff', probability: 0, type: 'cash', rewardKind: 'cash', bonusId: null, amount: 150, noWagering: true, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-cash-250', label: '250 ₺ Nakit', detail: 'Çevrimsiz direkt bakiye', bgColor: '#1d4ed8', textColor: '#ffffff', probability: 0, type: 'cash', rewardKind: 'cash', bonusId: null, amount: 250, noWagering: true, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-freebet-500', label: '500 ₺ Freebet', detail: 'Min. 1.80 oran · min. 3 maç kombine', bgColor: '#be123c', textColor: '#ffffff', probability: 3, type: 'bonus', rewardKind: 'freebet', bonusId: 1880, amount: 500, minOdd: 1.8, minSelectionCount: 3, betTypes: ['express'], assignmentValues: { BonusMoneyAmount: 500 }, requiresConfiguration: false, isLoss: false },
    { id: 'wheel-fs-sweet-500', label: '500 ₺ Freespin', detail: 'Sweet Bonanza · 250 spin · 2 ₺', bgColor: '#c2410c', textColor: '#ffffff', probability: 0, type: 'bonus', rewardKind: 'freespin', bonusId: null, amount: 500, gameName: 'Sweet Bonanza', spinValue: 2, spinCount: 250, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-cash-500', label: '500 ₺ Nakit', detail: 'Çevrimsiz direkt bakiye', bgColor: '#0f766e', textColor: '#ffffff', probability: 0, type: 'cash', rewardKind: 'cash', bonusId: null, amount: 500, noWagering: true, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-cash-10000', label: '10.000 ₺ Nakit', detail: 'Çevrimsiz direkt bakiye', bgColor: '#92400e', textColor: '#ffffff', probability: 0, type: 'cash', rewardKind: 'cash', bonusId: null, amount: 10000, noWagering: true, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-cash-50000', label: '50.000 ₺ Nakit', detail: 'Çevrimsiz direkt bakiye', bgColor: '#991b1b', textColor: '#ffffff', probability: 0, type: 'cash', rewardKind: 'cash', bonusId: null, amount: 50000, noWagering: true, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-watch', label: 'Apple Watch Ultra 3', detail: 'Fiziksel ödül · sınırlı stok', bgColor: '#334155', textColor: '#ffffff', probability: 0, type: 'physical', rewardKind: 'physical', bonusId: null, amount: 0, stock: 0, requiresConfiguration: true, isLoss: false },
    { id: 'wheel-iphone', label: 'iPhone 17 Pro Max 1TB', detail: 'Fiziksel ödül · sınırlı stok', bgColor: '#1e293b', textColor: '#ffffff', probability: 0, type: 'physical', rewardKind: 'physical', bonusId: null, amount: 0, stock: 0, requiresConfiguration: true, isLoss: false }
  ],
  telegramBonus: {
    enabled: false,
    channelUsername: '',
    chatId: '',
    bonusId: null,
    bonusLabel: 'Telegram Bonusu',
    amount: 0,
    assignmentValues: {}
  },
  scratchcard: {
    baseWinProbability: 10, // out of 100
    minInvestment: 0,
    rewards: [
       { id: 1, label: '25 TL Freebet', probability: 60, type: 'bonus', bonusId: 1875, amount: 25 },
       { id: 2, label: '50 TL Bonus', probability: 35, type: 'bonus', bonusId: 1876, amount: 50 },
       { id: 3, label: '100 TL Bonus', probability: 5, type: 'bonus', bonusId: 1877, amount: 100 }
    ]
  },
  predictionLeague: {
    isActive: true,
    title: 'Narcos Skor Tahmin',
    description: 'Haftanın maç skorlarını tahmin et, liderlik tablosunda yüksel.',
    prize: '50.000 TL Freebet Havuzu',
    weeklyTopCount: 10,
    weeklyRewardLabel: 'İlk 10 oyuncuya kişi başı 200 TL Freebet',
    weeklyRewardCampaignId: 1878,
    weeklyRewardAssignmentValues: { BonusMoneyAmount: 200 },
    monthlyRewardLabel: 'Ayın liderine 500 TL Freebet',
    monthlyRewardCampaignId: 1879,
    monthlyRewardAssignmentValues: { BonusMoneyAmount: 500 },
    monthlyPlayer: { title: 'AYIN OYUNCUSU', mainText: 'Skoru bilen, zirveye çıkan oyuncu burada.', subtitle: 'Aylık lider 500 TL Freebet kazanır.', imageUrl: '/assets/brand/narcosbahis.png' },    rules: 'Tam skor 3 puan, doğru taraf/beraberlik 1 puan kazandırır.',
    matches: [
      {
        id: 'match-1',
        homeTeam: 'Galatasaray',
        awayTeam: 'Fenerbahçe',
        league: 'Süper Lig',
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        status: 'open',
        homeScore: null,
        awayScore: null
      },
      {
        id: 'match-2',
        homeTeam: 'Beşiktaş',
        awayTeam: 'Trabzonspor',
        league: 'Süper Lig',
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
        status: 'open',
        homeScore: null,
        awayScore: null
      }
    ]
  },
  millionaires: {
    isActive: true,
    eyebrow: 'Büyük Kazanç Vitrini',
    title: 'Büyük kazanç anları burada parlıyor',
    description: 'Öne çıkan kazanç kayıtlarını, video anlarını ve yüksek ödül hikayelerini lobide tek vitrinde göster.',
    ctaLabel: 'Kazancı izle',
    showTicker: true,
    showSocial: false,
    disclaimer: '18+ Sorumlu oyun. Görseller ve videolar yalnızca izinli içeriklerle kullanılmalıdır.',
    socialLinks: [
      { id: 'instagram', label: 'Instagram', url: '' },
      { id: 'telegram', label: 'Telegram', url: '' }
    ],
    records: [
      { id: 'win-1', title: 'Gates of Olympus Super Scatter', amount: '₺1.210.512', player: 'A***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/uHS0jHVp4K', featured: false },
      { id: 'win-2', title: 'Big Bass Bonanza Keeping it Reel', amount: '₺1.441.075', player: 'M***', game: 'Big Bass Bonanza Keeping it Reel', imageUrl: '/assets/millionaires/big-bass-bonanza-keeping-it-reel.jpg', posterUrl: '/assets/millionaires/big-bass-bonanza-keeping-it-reel.jpg', videoUrl: 'https://www.ppreplaylink.net/WKReDGMLaU', featured: false },
      { id: 'win-3', title: 'Gates of Olympus 1000', amount: '₺750.000', player: 'D***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/iIrVagzrdf', featured: false },
      { id: 'win-4', title: 'Big Bass Splash 1000', amount: '₺853.100', player: 'S***', game: 'Big Bass Splash 1000', imageUrl: '/assets/millionaires/big-bass-splash-1000.jpg', posterUrl: '/assets/millionaires/big-bass-splash-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/i7RehODsPE', featured: false },
      { id: 'win-5', title: 'Gates of Olympus', amount: '₺2.000.000', player: 'K***', game: 'Gates of Olympus', imageUrl: '/assets/millionaires/gates-of-olympus.jpg', posterUrl: '/assets/millionaires/gates-of-olympus.jpg', videoUrl: 'https://www.ppreplaylink.net/NJLIpRw4zW', featured: false },
      { id: 'win-6', title: 'Gates of Olympus Super Scatter', amount: '₺714.000', player: 'B***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/QS1MfZnC7m', featured: false },
      { id: 'win-7', title: 'Starlight Princess 1000', amount: '₺2.400.000', player: 'E***', game: 'Starlight Princess 1000', imageUrl: '/assets/millionaires/starlight-princess-1000.png', posterUrl: '/assets/millionaires/starlight-princess-1000.png', videoUrl: 'https://www.ppreplaylink.net/JnpZlOPrAs', featured: false },
      { id: 'win-8', title: 'Fruit Party 2', amount: '₺1.240.680', player: 'C***', game: 'Fruit Party 2', imageUrl: '/assets/millionaires/fruit-party-2.jpg', posterUrl: '/assets/millionaires/fruit-party-2.jpg', videoUrl: 'https://www.ppreplaylink.net/gQh1zRCTJ9', featured: false },
      { id: 'win-9', title: '5 Lion Megaways 2', amount: '₺785.600', player: 'N***', game: '5 Lion Megaways 2', imageUrl: '/assets/millionaires/five-lion-megaways-2.jpg', posterUrl: '/assets/millionaires/five-lion-megaways-2.jpg', videoUrl: 'https://www.ppreplaylink.net/OW87vpJrGw', featured: false },
      { id: 'win-10', title: 'Sweet Bonanza 1000', amount: '₺1.041.540', player: 'R***', game: 'Sweet Bonanza 1000', imageUrl: '/assets/millionaires/sweet-bonanza-1000.jpg', posterUrl: '/assets/millionaires/sweet-bonanza-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/uk1hsdQgHv', featured: false },
      { id: 'win-11', title: 'Gates of Olympus Super Scatter', amount: '₺1.010.880', player: 'T***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/iQhLCif2fg', featured: false },
      { id: 'win-12', title: 'Gates of Olympus 1000', amount: '₺920.000', player: 'Y***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/ERReI97g6O', featured: false },
      { id: 'win-13', title: 'Gates of Olympus 1000', amount: '₺890.000', player: 'L***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/FnVwxwwxP5', featured: false },
      { id: 'win-14', title: 'Gates of Olympus Dice', amount: '₺670.000', player: 'O***', game: 'Gates of Olympus Dice', imageUrl: '/assets/millionaires/gates-olympus-dice.png', posterUrl: '/assets/millionaires/gates-olympus-dice.png', videoUrl: 'https://www.ppreplaylink.net/eOFqvpmbEX', featured: false },
      { id: 'win-15', title: 'Gates of Olympus Super Scatter', amount: '₺1.650.000', player: 'P***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/JCbwwa0426', featured: false },
      { id: 'win-16', title: 'Sugar Rush 1000', amount: '₺4.059.260', player: 'Z***', game: 'Sugar Rush 1000', imageUrl: '/assets/millionaires/sugar-rush-1000.png', posterUrl: '/assets/millionaires/sugar-rush-1000.png', videoUrl: 'https://www.ppreplaylink.net/k9lhEUotSu', featured: true },
      { id: 'win-17', title: 'Gems Bonanza', amount: '₺612.500', player: 'G***', game: 'Gems Bonanza', imageUrl: '/assets/millionaires/gems-bonanza.png', posterUrl: '/assets/millionaires/gems-bonanza.png', videoUrl: 'https://www.ppreplaylink.net/UPq8prHGoF', featured: false }
    ]
  },
  vip: {
    isActive: true,
    eyebrow: 'VIP Üyelik Programı',
    title: 'Ayrıcalıklı deneyim, özel avantajlar',
    description: 'Sadık oyuncularımıza özel 4 kademeli VIP programıyla kazancını ve deneyimini üst seviyeye taşı.',
    stats: [
      { id: 's1', value: '15K+', label: 'VIP Üye' },
      { id: 's2', value: '7/24', label: 'Destek' },
      { id: 's3', value: '%99', label: 'Memnuniyet' },
      { id: 's4', value: '8M₺', label: 'Aylık Bonus' }
    ],
    tiers: [
      { id: 'prestij', badge: '🏅', label: 'Prestij', sublabel: 'Başlangıç', popular: false, perks: ['7/24 Kişisel VIP Asistanı', 'Öncelikli müşteri desteği', 'Özel hoşgeldin bonusu', 'Haftalık cashback teklifi'] },
      { id: 'champion', badge: '🏆', label: 'Champion', sublabel: 'Popüler', popular: true, perks: ['Tüm Prestij avantajları', 'Özel etkinliklere davet', 'Extra promosyonlar', 'Hızlandırılmış çekim', 'Kişisel bonus danışmanı'] },
      { id: 'elite', badge: '💠', label: 'Elite', sublabel: 'Premium', popular: false, perks: ['Tüm Champion avantajları', 'VIP çekim limitleri', 'Doğum günü özel bonusu', 'Lüks etkinlik davetleri', 'Öncelikli VIP hattı'] },
      { id: 'master', badge: '👑', label: 'Master', sublabel: 'Ultimate', popular: false, perks: ['Tüm Elite avantajları', 'Limitsiz avantajlar', 'Özel günlerde hediyeler', 'Kişisel VIP koordinatörü', 'Sınırsız bonus fırsatı'] }
    ],
    faq: [
      { id: 'f1', q: 'VIP üyelik nasıl alınır?', a: 'Aşağıdaki formu doldurarak başvuru yapabilirsiniz. Ekibimiz en kısa sürede sizinle iletişime geçecektir.' },
      { id: 'f2', q: 'VIP seviyeleri nasıl belirlenir?', a: 'Yatırım miktarı, platform aktiviteniz ve sadakat puanlarınıza göre seviyeniz otomatik olarak güncellenir.' },
      { id: 'f3', q: 'VIP üyeliğin ücretli olup olmadığı?', a: 'VIP programımız tamamen ücretsizdir. Belirli aktivite eşiklerini geçtiğinizde otomatik olarak davet edilirsiniz.' },
      { id: 'f4', q: 'Hangi bonuslar VIP üyelere özel?', a: 'Cashback oranları, yükleme bonusları, freespin miktarları ve özel etkinlik ödülleri VIP seviyenize göre artış gösterir.' }
    ],
    formActive: true,
    formTitle: 'VIP başvurusu',
    formButtonText: 'Başvur',
    formSuccessMessage: 'VIP başvurunuz alındı! Ekibimiz en kısa sürede sizinle iletişime geçecek.',
    showStats: true,
    showFaq: true
  },
  dailyTasks: {
    isActive: true,
    title: 'Günlük Görevler',
    description: 'Gün içindeki gerçek aktivitenizi tamamlayın, XP ve ödül kazanın.',
    resetHour: 0,
    tasks: [
      { id: 'daily-login', title: 'Günlük giriş', description: 'Lobiye giriş yap.', metric: 'login', target: 1, xp: 50, rewardLabel: '25 TL Freebet', rewardBonusId: 1875, rewardAmount: 25, active: true },
      { id: 'daily-deposit', title: 'Günlük yatırım', description: 'Bugün toplam 500 TL yatırım yap.', metric: 'deposit_total', target: 500, xp: 120, rewardLabel: '50 TL Bonus', rewardBonusId: 1876, rewardAmount: 50, active: true },
      { id: 'daily-wager', title: 'Bahis hacmi', description: 'Bugün toplam 1.000 TL oyun hacmine ulaş.', metric: 'wager_total', target: 1000, xp: 160, rewardLabel: '100 TL Bonus', rewardBonusId: 1877, rewardAmount: 100, active: true }
    ]
  },
  battlePass: {
    isActive: true,
    seasonId: 'season-1',
    title: 'Sezon Kartı',
    description: 'Yatırım, oyun hacmi ve görevlerden XP toplayarak sezon ödüllerini aç.',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    premiumEnabled: false,
    xpRules: [
      { id: 'xp-deposit', label: 'Yatırım XP', metric: 'deposit_total', unit: 100, xp: 10, cap: 1500, active: true },
      { id: 'xp-wager', label: 'Oyun hacmi XP', metric: 'wager_total', unit: 500, xp: 15, cap: 2500, active: true },
      { id: 'xp-bonus', label: 'Bonus aktivitesi XP', metric: 'bonus_count', unit: 1, xp: 30, cap: 600, active: true }
    ],
    levels: [
      { level: 1, requiredXp: 100, freeRewardLabel: '25 TL Freebet', freeBonusId: 1875, freeAmount: 25, premiumRewardLabel: '50 TL Bonus', premiumBonusId: 1876, premiumAmount: 50 },
      { level: 2, requiredXp: 250, freeRewardLabel: '50 TL Bonus', freeBonusId: 1876, freeAmount: 50, premiumRewardLabel: '100 TL Bonus', premiumBonusId: 1877, premiumAmount: 100 },
      { level: 3, requiredXp: 500, freeRewardLabel: '20 Freespin', freeBonusId: null, freeAmount: 20, premiumRewardLabel: '50 Freespin', premiumBonusId: null, premiumAmount: 50 },
      { level: 4, requiredXp: 900, freeRewardLabel: '100 TL Bonus', freeBonusId: 1877, freeAmount: 100, premiumRewardLabel: '100 TL Bonus', premiumBonusId: 1877, premiumAmount: 100 },
      { level: 5, requiredXp: 1400, freeRewardLabel: '250 TL Final Ödülü', freeBonusId: null, freeAmount: 250, premiumRewardLabel: '500 TL Final Ödülü', premiumBonusId: null, premiumAmount: 500 }
    ]
  }
};

function gameSettingsPath(tenantKey: string) {
  return path.join(TENANT_GAMES_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function wheelCodesPath(tenantKey: string) {
  return path.join(TENANT_WHEEL_CODES_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function wheelClaimsPath(tenantKey: string) {
  return path.join(TENANT_WHEEL_CLAIMS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function predictionEntriesPath(tenantKey: string) {
  return path.join(TENANT_PREDICTIONS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function predictionSettlementsPath(tenantKey: string) {
  return path.join(TENANT_PREDICTION_SETTLEMENTS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function engagementClaimsPath(tenantKey: string) {
  return path.join(TENANT_ENGAGEMENT_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function mergeLobbyPages(pages: any) {
  const source = pages && typeof pages === 'object' ? pages : {};
  const defaults = DEFAULT_GAME_SETTINGS.lobby.pages;
  const merged: Record<string, any> = {};

  Object.entries(defaults).forEach(([pageId, page]) => {
    const savedPage = source[pageId] && typeof source[pageId] === 'object' ? source[pageId] : {};
    const defaultExtra = (page as any).extra && typeof (page as any).extra === 'object' ? (page as any).extra : {};
    const savedExtra = savedPage.extra && typeof savedPage.extra === 'object' ? savedPage.extra : {};

    merged[pageId] = {
      ...(page as any),
      ...savedPage,
      extra: {
        ...defaultExtra,
        ...savedExtra
      }
    };
  });

  Object.entries(source).forEach(([pageId, page]) => {
    if (!merged[pageId]) merged[pageId] = page;
  });

  return merged;
}

function ensureTenantDirs() {
  fs.mkdirSync(TENANT_GAMES_DIR, { recursive: true });
  fs.mkdirSync(TENANT_WHEEL_CODES_DIR, { recursive: true });
  fs.mkdirSync(TENANT_WHEEL_CLAIMS_DIR, { recursive: true });
  fs.mkdirSync(TENANT_PREDICTIONS_DIR, { recursive: true });
  fs.mkdirSync(TENANT_PREDICTION_SETTLEMENTS_DIR, { recursive: true });
  fs.mkdirSync(TENANT_ENGAGEMENT_DIR, { recursive: true });
  ensureTelegramLinkDir();
  fs.mkdirSync(TENANT_TELEGRAM_CLAIMS_DIR, { recursive: true });
}


function telegramClaimsPath(tenantKey: string) {
  return path.join(TENANT_TELEGRAM_CLAIMS_DIR, `${tenantKey}.json`);
}

async function readTelegramClaims(tenantKey: string): Promise<any[]> {
  const data = await readStoredDocument<any[]>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'telegram-claims',
    filePath: telegramClaimsPath(tenantKey),
    fallback: () => [],
  });
  return Array.isArray(data) ? data : [];
}

async function writeTelegramClaims(claims: any[], tenantKey: string): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'telegram-claims', filePath: telegramClaimsPath(tenantKey) },
    claims,
  );
}

function mergeGameSettings(settings: any) {
  return {
    ...DEFAULT_GAME_SETTINGS,
    ...settings,
    wheelAppearance: {
      ...DEFAULT_GAME_SETTINGS.wheelAppearance,
      ...(settings?.wheelAppearance || {})
    },
    lobby: {
      ...DEFAULT_GAME_SETTINGS.lobby,
      ...(settings?.lobby || {}),
      quickAccess: Array.isArray(settings?.lobby?.quickAccess)
        ? settings.lobby.quickAccess
        : DEFAULT_GAME_SETTINGS.lobby.quickAccess,
      pages: mergeLobbyPages(settings?.lobby?.pages),
      tabs: {
        games: {
          ...DEFAULT_GAME_SETTINGS.lobby.tabs.games,
          ...(settings?.lobby?.tabs?.games || {})
        },
        tournaments: {
          ...DEFAULT_GAME_SETTINGS.lobby.tabs.tournaments,
          ...(settings?.lobby?.tabs?.tournaments || {}),
          cards: Array.isArray(settings?.lobby?.tabs?.tournaments?.cards)
            ? settings.lobby.tabs.tournaments.cards
            : DEFAULT_GAME_SETTINGS.lobby.tabs.tournaments.cards
        },
        support: {
          ...DEFAULT_GAME_SETTINGS.lobby.tabs.support,
          ...(settings?.lobby?.tabs?.support || {}),
          cards: Array.isArray(settings?.lobby?.tabs?.support?.cards)
            ? settings.lobby.tabs.support.cards
            : DEFAULT_GAME_SETTINGS.lobby.tabs.support.cards
        }
      },
      banner: {
        ...DEFAULT_GAME_SETTINGS.lobby.banner,
        ...(settings?.lobby?.banner || {})
      }
    },
    telegramBonus: {
      ...DEFAULT_GAME_SETTINGS.telegramBonus,
      ...(settings?.telegramBonus || {})
    },
    scratchcard: {
      ...DEFAULT_GAME_SETTINGS.scratchcard,
      ...(settings?.scratchcard || {})
    },
    predictionLeague: {
      ...DEFAULT_GAME_SETTINGS.predictionLeague,
      ...(settings?.predictionLeague || {}),
      matches: Array.isArray(settings?.predictionLeague?.matches)
        ? settings.predictionLeague.matches
        : DEFAULT_GAME_SETTINGS.predictionLeague.matches
    },
    millionaires: {
      ...DEFAULT_GAME_SETTINGS.millionaires,
      ...(settings?.millionaires || {}),
      records: Array.isArray(settings?.millionaires?.records)
        ? settings.millionaires.records
        : DEFAULT_GAME_SETTINGS.millionaires.records,
      socialLinks: Array.isArray(settings?.millionaires?.socialLinks)
        ? settings.millionaires.socialLinks
        : DEFAULT_GAME_SETTINGS.millionaires.socialLinks
    },
    dailyTasks: {
      ...DEFAULT_GAME_SETTINGS.dailyTasks,
      ...(settings?.dailyTasks || {}),
      tasks: Array.isArray(settings?.dailyTasks?.tasks)
        ? settings.dailyTasks.tasks
        : DEFAULT_GAME_SETTINGS.dailyTasks.tasks
    },
    battlePass: {
      ...DEFAULT_GAME_SETTINGS.battlePass,
      ...(settings?.battlePass || {}),
      xpRules: Array.isArray(settings?.battlePass?.xpRules)
        ? settings.battlePass.xpRules
        : DEFAULT_GAME_SETTINGS.battlePass.xpRules,
      levels: Array.isArray(settings?.battlePass?.levels)
        ? settings.battlePass.levels
        : DEFAULT_GAME_SETTINGS.battlePass.levels
    }
  };
}

export async function readGameSettings(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any>({
    tenantKey: key,
    namespace: 'game-settings',
    filePath: gameSettingsPath(key),
    fallback: () => {
      if (key === 'default' && fs.existsSync(GAMES_DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(GAMES_DATA_FILE, 'utf-8')); } catch { /* defaults below */ }
      }
      return DEFAULT_GAME_SETTINGS;
    },
  });
  return mergeGameSettings(data);
}

async function writeGameSettings(settings: any, tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const { codes: _codes, ...rest } = settings;
  await writeStoredDocument(
    { tenantKey: key, namespace: 'game-settings', filePath: gameSettingsPath(key) },
    rest,
  );
}

async function readWheelCodes(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any[]>({
    tenantKey: key,
    namespace: 'wheel-codes',
    filePath: wheelCodesPath(key),
    fallback: () => {
      if (key === 'default' && fs.existsSync(WHEEL_CODES_FILE)) {
        try { return JSON.parse(fs.readFileSync(WHEEL_CODES_FILE, 'utf-8')); } catch { /* empty below */ }
      }
      return [];
    },
  });
  return Array.isArray(data) ? data : [];
}

async function writeWheelCodes(codes: any[], tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'wheel-codes', filePath: wheelCodesPath(key) },
    Array.isArray(codes) ? codes : [],
  );
}

async function readWheelClaims(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any[]>({
    tenantKey: key,
    namespace: 'wheel-claims',
    filePath: wheelClaimsPath(key),
    fallback: [],
  });
  return Array.isArray(data) ? data : [];
}

async function writeWheelClaims(claims: any[], tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'wheel-claims', filePath: wheelClaimsPath(key) },
    Array.isArray(claims) ? claims : [],
  );
}

async function readPredictionEntries(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any[]>({
    tenantKey: key,
    namespace: 'prediction-entries',
    filePath: predictionEntriesPath(key),
    fallback: [],
  });
  return Array.isArray(data) ? data : [];
}

async function writePredictionEntries(entries: any[], tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'prediction-entries', filePath: predictionEntriesPath(key) },
    Array.isArray(entries) ? entries : [],
  );
}

async function readPredictionSettlements(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any[]>({
    tenantKey: key,
    namespace: 'prediction-settlements',
    filePath: predictionSettlementsPath(key),
    fallback: [],
  });
  return Array.isArray(data) ? data : [];
}

async function writePredictionSettlements(rows: any[], tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'prediction-settlements', filePath: predictionSettlementsPath(key) },
    Array.isArray(rows) ? rows : [],
  );
}

async function readEngagementClaims(tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  const data = await readStoredDocument<any>({
    tenantKey: key,
    namespace: 'engagement-claims',
    filePath: engagementClaimsPath(key),
    fallback: { daily: [], battlePass: [] },
  });
  return {
    daily: Array.isArray(data?.daily) ? data.daily : [],
    battlePass: Array.isArray(data?.battlePass) ? data.battlePass : [],
  };
}

async function writeEngagementClaims(claims: any, tenantKey = 'default') {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'engagement-claims', filePath: engagementClaimsPath(key) },
    {
      daily: Array.isArray(claims?.daily) ? claims.daily : [],
      battlePass: Array.isArray(claims?.battlePass) ? claims.battlePass : [],
    },
  );
}
function turkeyDateParts(value = new Date()) {
  const local = new Date(value.getTime() + TURKEY_UTC_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate(), weekday: local.getUTCDay() };
}

function turkeyDateAt(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms) - TURKEY_UTC_OFFSET_MS);
}

function toDateKey(date = new Date()) {
  const { year, month, day } = turkeyDateParts(date);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dailyWindow(resetHour = 0) {
  const hour = Math.max(0, Math.min(23, Number(resetHour) || 0));
  const now = new Date();
  const parts = turkeyDateParts(now);
  let from = turkeyDateAt(parts.year, parts.month, parts.day, hour);
  if (now.getTime() < from.getTime()) {
    const previous = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const previousParts = turkeyDateParts(previous);
    from = turkeyDateAt(previousParts.year, previousParts.month, previousParts.day, hour);
  }
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from, to, dateKey: toDateKey(from), timeZone: 'Europe/Istanbul' };
}

function turkeyPeriodWindow(period: 'weekly' | 'monthly', now = new Date()) {
  const parts = turkeyDateParts(now);
  if (period === 'monthly') {
    const from = turkeyDateAt(parts.year, parts.month, 1);
    const to = turkeyDateAt(parts.year, parts.month + 1, 1);
    return { from, to, key: `${parts.year}-${String(parts.month + 1).padStart(2, '0')}` };
  }
  const mondayOffset = (parts.weekday + 6) % 7;
  const from = turkeyDateAt(parts.year, parts.month, parts.day - mondayOffset);
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from, to, key: toDateKey(from) };
}
function toDDMMYY(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getFullYear()).slice(-2)}`;
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampProgress(value: number, target: number) {
  if (!target || target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function metricValue(activity: any, metric: string) {
  switch (metric) {
    case 'login':
      return 1;
    case 'deposit_total':
      return activity.depositTotal || 0;
    case 'deposit_count':
      return activity.depositCount || 0;
    case 'wager_total':
      return activity.wagerTotal || 0;
    case 'bonus_count':
      return activity.bonusCount || 0;
    default:
      return 0;
  }
}

function metricLabel(metric: string) {
  return {
    login: 'Giriş',
    deposit_total: 'Yatırım tutarı',
    deposit_count: 'Yatırım adedi',
    wager_total: 'Oyun hacmi',
    bonus_count: 'Bonus adedi'
  }[metric] || metric;
}

async function fetchBackofficeJson(apiConfig: { baseUrl: string; path: string }, token: string, body: any) {
  const url = `${apiConfig.baseUrl.replace(/\/$/, '')}/${apiConfig.path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      authentication: token.trim(),
      Accept: 'application/json, text/plain, */*'
    },
    body: JSON.stringify(body)
  });
  return res.json() as Promise<any>;
}

async function getClientByLogin(login: string, token: string) {
  if (isLynonConfigured()) {
    try {
      const player = await lynonFindPlayerByLogin(login);
      if (player) return { ...player, Id: player.Id, Login: player.Login };
    } catch (err) {
      console.warn('[games] Lynon oyuncu sorgusu başarısız; eski API deneniyor.', err);
    }
  }

  const data = await fetchBackofficeJson(config.clientsApi, token, {
    Login: login,
    MaxRows: 1,
    SkeepRows: 0,
    IsStartWithSearch: false
  });
  return data?.Data?.Objects?.[0] || null;
}

function sumKnownAmounts(objects: any[], keys: string[]) {
  return objects.reduce((sum, item) => {
    const key = keys.find((candidate) => item?.[candidate] != null);
    return sum + (key ? Math.abs(parseAmount(item[key])) : 0);
  }, 0);
}

async function buildPlayerActivity(login: string, from: Date, to: Date) {
  const key = `${login.toLocaleLowerCase('tr-TR')}|${from.toISOString()}|${to.toISOString()}`;
  const now = Date.now();
  const cached = playerActivityCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = buildPlayerActivityLive(login, from, to)
    .finally(() => {
      const current = playerActivityCache.get(key);
      if (current && current.expiresAt <= Date.now()) playerActivityCache.delete(key);
    });
  playerActivityCache.set(key, { value, expiresAt: now + PLAYER_ACTIVITY_CACHE_TTL_MS });
  return value;
}

async function buildPlayerActivityLive(login: string, from: Date, to: Date) {
  if (isLynonConfigured()) {
    // 1) Players Overview raporu (1841) — TEK istek, site geneli.
    //
    // Oyuncu basina dort ayri cagri yerine tek rapor: gunluk gorev ve
    // turnuva ayni pencereyi sorduğunda cevap onbellekten paylasiliyor.
    // Rapor FILTERED kolonlariyla tam da istenen araligi donuyor.
    try {
      const rapor = await oyuncuAktivitesi(login, from, to);
      if (rapor.ok) return rapor;
      // Oyuncu bu pencerede raporda yok (ornegin yeni kayit). Sifir
      // varsaymak yerine asagidaki kaynaklara dusuyoruz: oyuncunun
      // gercekten hareketsiz mi yoksa rapor disinda mi oldugunu
      // ayirt edemeyiz ve gorev haksiz yere tamamlanmamis gorunurdu.
    } catch (err) {
      console.warn('[games] Players Overview raporu okunamadı; oyuncu bazlı sorguya düşülüyor.', err);
    }

    // 2) Oyuncu bazli Lynon sorgulari (dort cagri).
    try {
      return await lynonPlayerActivity(login, from, to);
    } catch (err) {
      console.warn('[games] Lynon aktivite hesaplama başarısız; eski API deneniyor.', err);
    }
  }

  const token = getBackofficeToken();
  if (!token) {
    return { ok: false, status: 500, message: 'Backoffice token bulunamadı.' };
  }

  const client = await getClientByLogin(login, token);
  const clientId = client?.Id;
  if (!clientId) {
    return { ok: false, status: 404, message: 'Kullanıcı bulunamadı.' };
  }

  const startDate = toDDMMYY(from);
  const endDate = toDDMMYY(to);

  const [txData, turnoverData, bonusData] = await Promise.all([
    fetchBackofficeJson(config.clientProfileTransactionsApi, token, {
      ClientId: clientId,
      CurrencyId: 'TRY',
      DocumentTypeIds: [1, 2, 73],
      StartTimeLocal: startDate,
      EndTimeLocal: endDate,
      MaxRows: 100,
      SkeepRows: 0,
      OrderedItem: 1,
      IsOrderedDesc: true
    }).catch((err) => ({ __error: err })),
    fetchBackofficeJson(config.clientTurnoversApi, token, {
      ByPassTotals: false,
      ClientId: String(clientId),
      CurrencyId: 'TRY',
      StartTimeLocal: startDate,
      EndTimeLocal: endDate,
      IsTest: false,
      MaxRows: 100,
      SkeepRows: 0,
      OrderedItem: 1,
      IsOrderedDesc: true
    }).catch((err) => ({ __error: err })),
    fetchBackofficeJson(config.clientBonusesApi, token, {
      ClientId: clientId,
      BonusType: null,
      FromDateLocal: `${startDate} - 00:00:00`,
      ToDateLocal: `${endDate} - 23:59:59`,
      MaxRows: 100,
      SkeepRows: 0
    }).catch((err) => ({ __error: err }))
  ]);

  const transactions = Array.isArray(txData?.Data?.Objects) ? txData.Data.Objects : [];
  const turnoverObjects = Array.isArray(turnoverData?.Data?.Objects) ? turnoverData.Data.Objects : [];
  const bonuses = Array.isArray(bonusData?.Data?.Objects)
    ? bonusData.Data.Objects
    : Array.isArray(bonusData?.Data)
      ? bonusData.Data
      : [];

  const depositRows = transactions.filter((tx: any) => {
    const name = String(tx?.DocumentTypeName || tx?.TypeName || '').toLocaleLowerCase('tr-TR');
    return !name || name.includes('yat') || name.includes('deposit');
  });

  const depositTotal = sumKnownAmounts(depositRows, ['Amount', 'PaymentAmount', 'TransactionAmount']);
  const wagerTotal = sumKnownAmounts(turnoverObjects, [
    'BetAmount',
    'BetAmountByReportCurrency',
    'TotalBetAmount',
    'TurnoverAmount',
    'Turnover',
    'CasinoBetAmount',
    'SportBetAmount',
    'TotalStake',
    'Stake',
    'Amount'
  ]) || Math.abs(parseAmount(turnoverData?.Data?.TotalBetAmount || turnoverData?.Data?.BetAmount || turnoverData?.Data?.TurnoverAmount));

  return {
    ok: true,
    clientId,
    login,
    from: from.toISOString(),
    to: to.toISOString(),
    depositTotal,
    depositCount: depositRows.length,
    wagerTotal,
    bonusCount: bonuses.length
  };
}

function seasonWindow(battlePass: any) {
  const startsAt = battlePass?.startsAt ? new Date(battlePass.startsAt) : new Date();
  const endsAt = battlePass?.endsAt ? new Date(battlePass.endsAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const from = Number.isFinite(startsAt.getTime()) ? startsAt : new Date();
  const to = Number.isFinite(endsAt.getTime()) ? endsAt : new Date();
  return { from, to };
}

function normalizeDailyTasks(settings: any) {
  const cfg = settings.dailyTasks || DEFAULT_GAME_SETTINGS.dailyTasks;
  return {
    ...DEFAULT_GAME_SETTINGS.dailyTasks,
    ...cfg,
    tasks: Array.isArray(cfg.tasks) ? cfg.tasks : DEFAULT_GAME_SETTINGS.dailyTasks.tasks
  };
}

function normalizeBattlePass(settings: any) {
  const cfg = settings.battlePass || DEFAULT_GAME_SETTINGS.battlePass;
  return {
    ...DEFAULT_GAME_SETTINGS.battlePass,
    ...cfg,
    xpRules: Array.isArray(cfg.xpRules) ? cfg.xpRules : DEFAULT_GAME_SETTINGS.battlePass.xpRules,
    levels: Array.isArray(cfg.levels) ? cfg.levels : DEFAULT_GAME_SETTINGS.battlePass.levels
  };
}

function dailyTaskReward(task: any) {
  return {
    label: task.rewardLabel || task.title || '',
    bonusId: task.rewardBonusId,
    amount: Number(task.rewardAmount || 0)
  };
}

function levelReward(level: any, track: string) {
  const premium = track === 'premium';
  return {
    label: premium ? level.premiumRewardLabel : level.freeRewardLabel,
    bonusId: premium ? level.premiumBonusId : level.freeBonusId,
    amount: Number(premium ? level.premiumAmount || 0 : level.freeAmount || 0)
  };
}

async function grantReward(login: string, reward: { label?: string; bonusId?: any; amount?: number }) {
  const hasReward = reward?.label || reward?.bonusId || Number(reward?.amount || 0) > 0;
  if (!hasReward) return { ok: true, skipped: true };
  return chargeBonusToPlayer(login, reward.bonusId ? Number(reward.bonusId) : null, reward.label || '', reward.amount);
}

function buildDailyTasksPayload(settings: any, claims: any, activity: any, username: string) {
  const cfg = normalizeDailyTasks(settings);
  const { dateKey } = dailyWindow(cfg.resetHour);
  const dailyClaims = claims.daily.filter((claim: any) => claim.username === username && claim.dateKey === dateKey);

  const tasks = cfg.tasks
    .filter((task: any) => task.active !== false)
    .map((task: any) => {
      const target = Math.max(Number(task.target || 1), 1);
      const value = metricValue(activity, task.metric);
      const claimed = dailyClaims.some((claim: any) => claim.taskId === task.id);
      return {
        ...task,
        metricLabel: metricLabel(task.metric),
        value,
        target,
        progress: clampProgress(value, target),
        completed: value >= target,
        claimed
      };
    });

  return {
    ...cfg,
    dateKey,
    activity,
    tasks,
    completedCount: tasks.filter((task: any) => task.completed).length,
    claimedCount: tasks.filter((task: any) => task.claimed).length
  };
}

function buildBattlePassPayload(settings: any, claims: any, activity: any, username: string) {
  const cfg = normalizeBattlePass(settings);
  const { from, to } = seasonWindow(cfg);
  const now = Date.now();
  const isInSeason = now >= from.getTime() && now <= to.getTime();
  const seasonId = cfg.seasonId || 'season-1';
  const rules = (cfg.xpRules || []).filter((rule: any) => rule.active !== false);

  const activityXp = rules.reduce((sum: number, rule: any) => {
    const unit = Math.max(Number(rule.unit || 1), 1);
    const gained = Math.floor(metricValue(activity, rule.metric) / unit) * Number(rule.xp || 0);
    const cap = Number(rule.cap || 0);
    return sum + (cap > 0 ? Math.min(gained, cap) : gained);
  }, 0);

  const taskXp = claims.daily
    .filter((claim: any) => claim.username === username)
    .filter((claim: any) => {
      const ts = new Date(claim.claimedAt || 0).getTime();
      return ts >= from.getTime() && ts <= to.getTime();
    })
    .reduce((sum: number, claim: any) => sum + Number(claim.xp || 0), 0);

  const totalXp = activityXp + taskXp;
  const battleClaims = claims.battlePass.filter((claim: any) => claim.username === username && claim.seasonId === seasonId);
  const levels = [...(cfg.levels || [])]
    .sort((a: any, b: any) => Number(a.level || 0) - Number(b.level || 0))
    .map((level: any) => {
      const requiredXp = Number(level.requiredXp || 0);
      const unlocked = totalXp >= requiredXp;
      return {
        ...level,
        requiredXp,
        unlocked,
        freeClaimed: battleClaims.some((claim: any) => claim.level === Number(level.level) && claim.track === 'free'),
        premiumClaimed: battleClaims.some((claim: any) => claim.level === Number(level.level) && claim.track === 'premium')
      };
    });

  const unlockedLevels = levels.filter((level: any) => level.unlocked);
  const nextLevel = levels.find((level: any) => !level.unlocked) || null;

  return {
    ...cfg,
    seasonId,
    startsAt: from.toISOString(),
    endsAt: to.toISOString(),
    isInSeason,
    activity,
    xp: {
      total: totalXp,
      activity: activityXp,
      tasks: taskXp,
      nextRequired: nextLevel?.requiredXp || null
    },
    currentLevel: unlockedLevels.length ? Number(unlockedLevels[unlockedLevels.length - 1].level || 0) : 0,
    nextLevel,
    levels
  };
}

function predictionPoints(entry: any, match: any) {
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return 0;

  const predictedHome = Number(entry.homeScore);
  const predictedAway = Number(entry.awayScore);
  if (predictedHome === homeScore && predictedAway === awayScore) return 3;

  const actualResult = Math.sign(homeScore - awayScore);
  const predictedResult = Math.sign(predictedHome - predictedAway);
  return actualResult === predictedResult ? 1 : 0;
}

function scorePredictionLeaderboard(entries: any[], matches: any[], from: Date, to: Date) {
  const board = new Map<string, { username: string; points: number; exact: number; total: number }>();
  entries.forEach((entry) => {
    const match = matches.find((item: any) => item.id === entry.matchId);
    const startsAt = match?.startsAt ? new Date(match.startsAt) : null;
    if (!match || !startsAt || startsAt < from || startsAt >= to) return;
    const points = predictionPoints(entry, match);
    const current = board.get(entry.username) || { username: entry.username, points: 0, exact: 0, total: 0 };
    current.points += points;
    current.exact += points === 3 ? 1 : 0;
    current.total += 1;
    board.set(entry.username, current);
  });
  return Array.from(board.values()).sort((a, b) => b.points - a.points || b.exact - a.exact || a.username.localeCompare(b.username, 'tr'));
}

/**
 * Bir maç için tahminlerin kapandığı an (ms) — yoksa null.
 *
 * predictionClosesAt yönetici tarafından girilebilen açık son tarih. Boşsa
 * geriye dönük uyumluluk için maçın başlama saati kullanılır.
 */
export function tahminKapanisZamani(match: any): number | null {
  const acik = match?.predictionClosesAt ? new Date(match.predictionClosesAt).getTime() : NaN;
  if (Number.isFinite(acik)) return acik;
  const baslangic = match?.startsAt ? new Date(match.startsAt).getTime() : NaN;
  return Number.isFinite(baslangic) ? baslangic : null;
}

function buildPredictionLeaguePayload(settings: any, entries: any[], username?: string) {
  const league = settings.predictionLeague || DEFAULT_GAME_SETTINGS.predictionLeague;
  const matches = Array.isArray(league.matches) ? league.matches : [];
  const weekly = turkeyPeriodWindow('weekly');
  const monthly = turkeyPeriodWindow('monthly');
  const weeklyLeaderboard = scorePredictionLeaderboard(entries, matches, weekly.from, weekly.to);
  const monthlyLeaderboard = scorePredictionLeaderboard(entries, matches, monthly.from, monthly.to);
  const myPredictions = username ? entries.filter((entry) => entry.username === username) : [];
  return {
    ...league,
    leaderboard: weeklyLeaderboard.slice(0, 20),
    weeklyLeaderboard: weeklyLeaderboard.slice(0, 20),
    monthlyLeaderboard: monthlyLeaderboard.slice(0, 20),
    periods: { weekly: weekly.key, monthly: monthly.key, timeZone: 'Europe/Istanbul' },
    rewards: {
      weekly: { label: league.weeklyRewardLabel || 'İlk 10 oyuncuya kişi başı 200 TL Freebet', topCount: Number(league.weeklyTopCount || 10), campaignId: league.weeklyRewardCampaignId || null },
      monthly: { label: league.monthlyRewardLabel || 'Ayın liderine 500 TL Freebet', topCount: 1, campaignId: league.monthlyRewardCampaignId || null },
    },
    myPredictions,
    totalPredictions: entries.length
  };
}
let bonusCache: { data: any[], ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getActiveBonusDefinitions() {
    if (bonusCache && (Date.now() - bonusCache.ts < CACHE_TTL)) return bonusCache.data;
    const token = getBackofficeToken();
    if (!token) return [];

    try {
        // Dashboard ile aynı prefix'i kullanmaya çalış (Genellikle api/tr/Dashboard)
        const prefix = config.api.dashboardPathPrefix || 'api/tr/Dashboard';
        const url = `${config.api.baseUrl.replace(/\/$/, '')}/${prefix.replace(/^\//, '')}/GetBonusDefinitions`;
        
        console.log(`[games] Bonus listesi çekiliyor: ${url}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'authentication': token.trim(),
                'Accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify({ StateType: 1 }) // Only active
        });
        const json = await res.json() as any;
        const list = Array.isArray(json?.Data) ? json.Data : [];
        console.log(`[games] ${list.length} aktif bonus yüklendi.`);
        bonusCache = { data: list, ts: Date.now() };
        return list;
    } catch (e) {
        console.error('Bonus listesi çekilemedi:', e);
        return [];
    }
}

async function chargeBonusToPlayer(login: string, bonusId: number | null, label: string = '', explicitAmount?: number, explicitAssignmentValues: Record<string, unknown> = {}) {
    if (isLynonConfigured()) {
        if (!bonusId || !Number.isFinite(Number(bonusId))) {
            return { ok: false, message: 'Bu ödül için Lynon kampanyası seçilmemiş.' };
        }
        try {
            const player = await lynonFindPlayerByLogin(login);
            if (!player?.Id) return { ok: false, message: 'Oyuncu Lynon’da bulunamadı.' };
            const result = await lynonAssignCampaignToPlayer({
                campaignId: Number(bonusId),
                playerId: player.Id,
                assignmentReason: `Narcosbahis oyun ödülü: ${label || 'Ödül'}`,
                assignmentValues: { ...(Number(explicitAmount) > 0 ? { BonusMoneyAmount: Number(explicitAmount) } : {}), ...explicitAssignmentValues },
            });
            return { ok: true, lynon: true, data: result, message: 'Ödül Lynon kampanyası olarak tanımlandı.' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lynon kampanya ataması başarısız.';
            return { ok: false, lynon: true, message };
        }
    }

    const token = getBackofficeToken();
    if (!token) {
        console.error('[games] Hata: BetConstruct token bulunamadı (AUTH_TOKEN eksik).');
        return { ok: false, message: 'Auth token missing' };
    }

    console.log(`[games] "${login}" için otomatik bonus süreci başladı. Ödül: "${label}", Miktar: ${explicitAmount ?? 'Otomatik'}`);

    try {
        // 1. Get ClientId
        const clientsUrl = `${config.clientsApi.baseUrl.replace(/\/$/, '')}/${config.clientsApi.path.replace(/^\//, '')}`;
        const clientRes = await fetch(clientsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authentication': token.trim() },
            body: JSON.stringify({ Login: login, MaxRows: 1, SkeepRows: 0 })
        });
        const clientData = await clientRes.json() as any;
        const clientId = clientData?.Data?.Objects?.[0]?.Id;

        if (!clientId) {
            console.error(`[games] Hata: "${login}" kullanıcı adlı oyuncunun ClientId değeri bulunamadı.`);
            return { ok: false, message: 'Client not found' };
        }
        console.log(`[games] Oyuncu "${login}" ID: ${clientId}`);

        let finalBonusId = bonusId;
        let finalAmount = "0";

        // Extract amount from label (e.g. "10 TL Bonus" -> 10) if not explicitly provided
        if (explicitAmount != null && explicitAmount > 0) {
            finalAmount = String(explicitAmount);
        } else {
            const amountMatch = label.match(/(\d+)/);
            if (amountMatch) finalAmount = amountMatch[1];
        }

        // 2. Auto-discover bonusId by label if not provided
        if (!finalBonusId || finalBonusId === 0 || isNaN(Number(finalBonusId))) {
            console.log(`[games] Manuel ID yok veya geçersiz, isme göre aranıyor: "${label}"...`);
            const definitions = await getActiveBonusDefinitions();
            const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            
            // Search by exact match first, then by inclusion
            const match = definitions.find((d: any) => {
                const dName = (d.Name || d.DisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                // Eğer etiket miktarı içeriyorsa ve bonus ismi de o miktarı içeriyorsa daha güçlü bir eşleşme
                if (finalAmount !== "0" && dName.includes(finalAmount) && normalizedLabel.includes(finalAmount)) {
                    return dName.includes(normalizedLabel) || normalizedLabel.includes(dName);
                }
                return dName === normalizedLabel || dName.includes(normalizedLabel) || normalizedLabel.includes(dName);
            });

            if (match) {
                finalBonusId = match.Id;
                console.log(`[games] AKILLI EŞLEŞME BAŞARILI: "${label}" -> BC Bonus: "${match.Name}" (ID: ${finalBonusId})`);
            } else {
                console.warn(`[games] EŞLEŞME HATASI: "${label}" metniyle veya ${finalAmount} miktarıyla eşleşen aktif bonus bulunamadı.`);
                return { ok: false, message: `Bonus bulunamadı: ${label}` };
            }
        }

        // 3. Add Client To Bonus
        console.log(`[games] Bonus gönderiliyor: ClientId ${clientId}, PartnerBonusId ${finalBonusId}, Miktar: ${finalAmount}`);
        const chargeUrl = 'https://backofficewebadmin.betconstruct.com/api/tr/Client/AddClientToBonus';
        const chargeRes = await fetch(chargeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'authentication': token.trim(),
                'Accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify({ 
                ClientId: Number(clientId), 
                PartnerBonusId: Number(finalBonusId), 
                Amount: Number(finalAmount || 0),
                MessageChannel: null,
                MessageSubject: null,
                MessageContent: null
            })
        });
        const chargeResult = await chargeRes.json() as any;

        if (chargeResult.HasError) {
           const errMsg = chargeResult.AlertMessage || chargeResult.ErrorDescription || 'Bilinmeyen hata';
           console.error(`[games] BC API HATASI: ${errMsg}`);
           return { ok: false, message: errMsg, bcResponse: chargeResult };
        }

        console.log(`[games] İŞLEM BAŞARILI: Oyuncuya bonus yüklendi.`);
        return { ok: true, data: chargeResult, matchedId: finalBonusId, amount: finalAmount };
    } catch (err) {
        console.error('[games] KRİTİK HATA:', err);
        return { ok: false, message: (err as Error).message };
    }
}

/**
 * Bu tutarın üzerindeki nakit ödüller "yüksek nakit" sayılır ve çarkta asla
 * çıkmaz. Elle onaylı kampanya dışında dağıtılmaları istenmiyor.
 */
const YUKSEK_NAKIT_ESIGI = 1000;

/**
 * Bir dilimin çekilişe girip giremeyeceği. Olasılık admin panelinde yanlışlıkla
 * sıfırdan farklı bırakılsa bile burada engellenir; kural veriye değil koda bağlı.
 *
 * Üç gerekçe:
 *  1. requiresConfiguration → deliverWheelReward zaten teslim edemiyor
 *     ("Bu ödül henüz Lynon teslimatına bağlanmamış"). Oyuncuya kazandı deyip
 *     ardından hata göstermek en kötü sonuç.
 *  2. physical → fiziksel ödüller çarkta dağıtılmıyor.
 *  3. cash > YUKSEK_NAKIT_ESIGI → yüksek nakit ödüller çarkta dağıtılmıyor.
 */
export function cekilebilirMi(slice: any): boolean {
  if (!slice) return false;
  // Kayıp dilimi ("Tekrar Dene") her zaman çekilebilir.
  if (slice.type === 'none' || slice.isLoss === true) return true;
  if (slice.requiresConfiguration === true) return false;
  if (slice.type === 'physical') return false;
  if (slice.type === 'cash' && Number(slice.amount) > YUKSEK_NAKIT_ESIGI) return false;
  return true;
}

async function deliverWheelReward(login: string, slice: any) {
  if (!slice || slice.type === 'none' || slice.isLoss) {
    return { ok: true, delivery: 'none', message: 'Bu turda ödül çıkmadı.' };
  }
  if (slice.requiresConfiguration === true) {
    return { ok: false, delivery: slice.type, message: 'Bu ödül henüz Lynon teslimatına bağlanmamış.' };
  }

  if (slice.type === 'bonus') {
    return chargeBonusToPlayer(
      login,
      slice.bonusId ? Number(slice.bonusId) : null,
      slice.label,
      slice.amount,
      slice.assignmentValues || {}
    );
  }

  if (slice.type === 'cash') {
    if (!isLynonConfigured()) return { ok: false, delivery: 'cash', message: 'Nakit ödül yalnızca Lynon ile tanımlanabilir.' };
    const player = await lynonFindPlayerByLogin(login);
    if (!player?.Id) return { ok: false, delivery: 'cash', message: 'Oyuncu Lynon’da bulunamadı.' };
    const result = await lynonCreditPlayerMainAccount({
      playerId: player.Id,
      amount: Number(slice.amount),
      note: `Çark ödülü ${String(slice.id).slice(0, 24)}`,
    });
    return { ok: true, lynon: true, delivery: 'cash', data: result, message: 'Nakit ödül PlayerAccount hesabına işlendi.' };
  }

  if (slice.type === 'physical') {
    if (!Number.isFinite(Number(slice.stock)) || Number(slice.stock) <= 0) {
      return { ok: false, delivery: 'physical', message: 'Fiziksel ödül stoğu tanımlanmamış.' };
    }
    return { ok: true, delivery: 'physical', manualFulfillment: true, message: 'Fiziksel ödül teslimat kuyruğuna alındı.' };
  }

  return { ok: false, message: 'Desteklenmeyen çark ödül tipi.' };
}

export async function gamesRoutes(app: FastifyInstance) {
  
  app.get('/games/config', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    const settings = await readGameSettings(tenantKey);
    const codes = await readWheelCodes(tenantKey);
    return reply.send({ ok: true, data: { ...settings, codes } });
  });

  app.post('/admin/games/config', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    
    const { codes, ...rest } = request.body;
    await writeGameSettings(rest, tenantKey);
    if (codes) await writeWheelCodes(codes, tenantKey);
    return reply.send({ ok: true });
  });

  app.get('/admin/games/wheel/claims', async (request: any, reply) => {
    if (!request.session?.user) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const claims = (await readWheelClaims(tenantKey)).slice(0, 500);
    return reply.send({ ok: true, data: claims, count: claims.length });
  });

  app.post('/admin/games/wheel/claims/:claimId/fulfillment', async (request: any, reply) => {
    if (!request.session?.user) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const claims = await readWheelClaims(tenantKey);
    const claim = claims.find((item: any) => item.id === request.params?.claimId);
    if (!claim || claim.rewardType !== 'physical') return reply.status(404).send({ ok: false, message: 'Fiziksel ödül kaydı bulunamadı.' });
    const status = String(request.body?.status || '');
    if (!['fulfilled', 'cancelled'].includes(status)) return reply.status(422).send({ ok: false, message: 'Geçersiz teslimat durumu.' });
    claim.status = status;
    claim.fulfillmentNote = String(request.body?.note || '').trim().slice(0, 500) || null;
    claim.fulfilledAt = status === 'fulfilled' ? new Date().toISOString() : null;
    claim.updatedAt = new Date().toISOString();
    await writeWheelClaims(claims, tenantKey);
    return reply.send({ ok: true, data: claim });
  });

  app.post('/games/wheel/play', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Önce kullanıcı adı doğrulaması yapmalısınız.' });
    }

    const login = String(bonusPanelUser.login).trim();
    const tenantKey = await resolveTenantKeyForRequest(request);
    const lockKey = `${tenantKey}|${login.toLocaleLowerCase('tr-TR')}`;
    if (wheelClaimLocks.has(lockKey)) {
      return reply.status(429).send({ ok: false, message: 'Çark işleminiz devam ediyor. Lütfen bekleyin.' });
    }
    wheelClaimLocks.add(lockKey);

    try {
      const { code } = request.body || {};
      const settings = await readGameSettings(tenantKey);
      const codesList = await readWheelCodes(tenantKey);
      const codeIdx = code ? codesList.findIndex((item: any) => item.code === code && !item.used) : -1;
      if (code && codeIdx === -1) {
        return reply.status(422).send({ ok: false, message: 'Geçersiz veya kullanılmış çark kodu.' });
      }

      const claims = await readWheelClaims(tenantKey);
      const dateKey = toDateKey();
      const dailyLimit = Math.max(1, Math.min(20, Number(settings.wheelDailyLimit || 1)));
      const usedToday = claims.filter((claim: any) =>
        claim.username === login &&
        claim.dateKey === dateKey &&
        ['pending', 'completed', 'granted', 'fulfillment_pending'].includes(String(claim.status))
      ).length;
      if (usedToday >= dailyLimit) {
        return reply.status(429).send({ ok: false, message: `Günlük çark hakkınızı kullandınız. Limit: ${dailyLimit}` });
      }

      const minInvestment = Number(settings.wheelMinInvestment || 0);
      if (!code && minInvestment > 0) {
        if (!isLynonConfigured()) {
          return reply.status(503).send({ ok: false, message: 'Yatırım doğrulaması için Lynon bağlantısı gerekli.' });
        }
        const snapshot = await lynonBuildBonusEligibilitySnapshot({ login });
        const lastDepositAmount = Number(snapshot.lastDeposit?.amount || 0);
        if (!snapshot.dataCompleteness?.payments || lastDepositAmount < minInvestment) {
          return reply.status(422).send({
            ok: false,
            message: `Çark için son başarılı yatırım en az ${minInvestment} TL olmalıdır.`,
            lastDeposit: lastDepositAmount,
            required: minInvestment,
          });
        }
      }

      const wheelSlices = Array.isArray(settings.wheel) ? settings.wheel : [];
      const activeSlices = wheelSlices
        .map((slice: any, index: number) => ({
          slice,
          index,
          weight: cekilebilirMi(slice) ? Math.max(0, Number(slice.probability) || 0) : 0,
        }))
        .filter((item: any) => item.weight > 0);
      const totalWeight = activeSlices.reduce((sum: number, item: any) => sum + item.weight, 0);
      if (totalWeight <= 0) {
        return reply.status(409).send({ ok: false, message: 'Çark olasılıkları henüz etkinleştirilmemiş.' });
      }

      let random = Math.random() * totalWeight;
      let selected = activeSlices[activeSlices.length - 1];
      for (const item of activeSlices) {
        random -= item.weight;
        if (random <= 0) {
          selected = item;
          break;
        }
      }

const selectedSlice = selected.slice;
      if (selectedSlice.type === 'physical') {
        const stock = Math.max(0, Number(selectedSlice.stock) || 0);
        const reserved = claims.filter((item: any) =>
          item.sliceId === selectedSlice.id && ['fulfillment_pending', 'fulfilled'].includes(String(item.status))
        ).length;
        if (stock <= reserved) {
          return reply.status(409).send({ ok: false, message: 'Seçilen fiziksel ödülün stoğu tükendi. Çark hakkınız kullanılmadı.' });
        }
      }

      const claim = {
        id: randomUUID(),
        tenantKey,
        username: login,
        dateKey,
        createdAt: new Date().toISOString(),
        status: 'pending',
        sliceId: selectedSlice.id,
        label: selectedSlice.label,
        rewardType: selectedSlice.type,
        amount: Number(selectedSlice.amount || 0),
        code: code || null,
      };
      claims.unshift(claim);
      await writeWheelClaims(claims, tenantKey);

      let delivery: any;
      try {
        delivery = await deliverWheelReward(login, selectedSlice);
      } catch (error) {
        delivery = { ok: false, message: error instanceof Error ? error.message : 'Ödül teslim edilemedi.' };
      }

      claim.status = delivery?.ok === true
        ? delivery.manualFulfillment
          ? 'fulfillment_pending'
          : selectedSlice.type === 'none'
            ? 'completed'
            : 'granted'
        : 'failed';
      (claim as any).completedAt = new Date().toISOString();
      (claim as any).delivery = delivery?.delivery || selectedSlice.type;
      (claim as any).message = delivery?.message || null;
      await writeWheelClaims(claims, tenantKey);

      if (delivery?.ok === true && codeIdx >= 0) {
        codesList[codeIdx] = {
          ...codesList[codeIdx],
          used: true,
          usedBy: login,
          usedAt: new Date().toISOString(),
          claimId: claim.id,
        };
        await writeWheelCodes(codesList, tenantKey);
      }

      return reply.status(delivery?.ok === true ? 200 : 422).send({
        ok: delivery?.ok === true,
        result: selectedSlice,
        sliceIndex: selected.index,
        claimId: claim.id,
        claimStatus: claim.status,
        chargeStatus: delivery,
        message: delivery?.message,
      });
    } finally {
      wheelClaimLocks.delete(lockKey);
    }
  });

  app.post('/games/wheel/validate-code', async (request: any, reply) => {
    const { code } = request.body || {};
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    const codesList = await readWheelCodes(tenantKey);
    const found = codesList?.find((c: any) => c.code === code && !c.used);
    if (found) {
        return reply.send({ ok: true, message: 'Kod geçerli.' });
    }
    return reply.send({ ok: false, message: 'Geçersiz veya kullanılmış kod.' });
  });

  app.post('/games/scratch/play', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Önce kullanıcı adı doğrulaması yapmalısınız.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const scratch = settings.scratchcard;

    const minInvestment = Number(scratch.minInvestment || 0);
    if (minInvestment > 0) {
      if (!isLynonConfigured()) {
        return reply.status(503).send({ ok: false, message: 'Yatırım doğrulaması için Lynon bağlantısı gerekli.' });
      }
      const snapshot = await lynonBuildBonusEligibilitySnapshot({ login: bonusPanelUser.login });
      const lastDepositAmount = Number(snapshot.lastDeposit?.amount || 0);
      if (!snapshot.dataCompleteness?.payments || lastDepositAmount < minInvestment) {
        return reply.status(422).send({
          ok: false,
          message: `Kazı kazan için son başarılı yatırım en az ${minInvestment} TL olmalıdır.`,
          lastDeposit: lastDepositAmount,
          required: minInvestment,
        });
      }
    }

    const isWin = (Math.random() * 100) < (scratch.baseWinProbability || 0);

    let selectedReward = null;
    let chargeStatus = null;

    if (isWin && scratch.rewards?.length > 0) {
       const totalWeight = scratch.rewards.reduce((sum: number, r: any) => sum + (Number(r.probability) || 0), 0);
       if (totalWeight > 0) {
          let rnd = Math.random() * totalWeight;
          for (let r of scratch.rewards) {
             rnd -= (Number(r.probability) || 0);
             if (rnd <= 0) {
                selectedReward = r;
                break;
             }
          }
       }
    }

    if (selectedReward) {
       chargeStatus = await chargeBonusToPlayer(bonusPanelUser.login, selectedReward.bonusId ? Number(selectedReward.bonusId) : null, selectedReward.label, selectedReward.amount, selectedReward.assignmentValues || {});
    }

    return reply.send({ ok: !selectedReward || chargeStatus?.ok === true, won: isWin, reward: selectedReward, chargeStatus, message: chargeStatus?.ok === false ? chargeStatus.message : undefined });
  });

  app.get('/games/telegram-bonus/status', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Önce kullanıcı adı doğrulaması yapmalısınız.' });
    }
    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const telegramBonus = settings.telegramBonus;
    if (!telegramBonus.enabled) {
      return reply.send({ ok: true, data: { enabled: false } });
    }

    const login = String(bonusPanelUser.login).trim();
    const [linkedId, claims] = await Promise.all([
      getLinkedTelegramUserId(tenantKey, login),
      readTelegramClaims(tenantKey),
    ]);
    const claimed = claims.some((c: any) => c.username === login && c.ok === true);

    return reply.send({
      ok: true,
      data: {
        enabled: true,
        isLinked: Boolean(linkedId),
        claimed,
        channelUsername: telegramBonus.channelUsername || null,
        linkUrl: config.telegram.botUsername
          ? `https://t.me/${config.telegram.botUsername}?start=${encodeURIComponent(login)}`
          : null,
      },
    });
  });

  app.post('/games/telegram-bonus/verify', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Önce kullanıcı adı doğrulaması yapmalısınız.' });
    }
    const login = String(bonusPanelUser.login).trim();
    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const telegramBonus = settings.telegramBonus;
    if (!telegramBonus.enabled) {
      return reply.status(409).send({ ok: false, message: 'Telegram bonusu şu anda aktif değil.' });
    }
    if (!isTelegramConfigured()) {
      return reply.status(503).send({ ok: false, message: 'Telegram entegrasyonu yapılandırılmamış.' });
    }
    if (!telegramBonus.chatId) {
      return reply.status(503).send({ ok: false, message: 'Telegram kanal/grup kimliği yapılandırılmamış.' });
    }

    const claims = await readTelegramClaims(tenantKey);
    if (claims.some((c: any) => c.username === login && c.ok === true)) {
      return reply.status(409).send({ ok: false, message: 'Telegram bonusunu zaten aldınız.' });
    }

    const telegramUserId = await getLinkedTelegramUserId(tenantKey, login);
    if (!telegramUserId) {
      return reply.status(422).send({ ok: false, message: 'Önce Telegram hesabınızı bağlayın.', linkRequired: true });
    }

    const membership = await getChatMember(telegramBonus.chatId, telegramUserId);
    if (!membership.ok) {
      // Sorgu düştüyse oyuncuyu "üye değil" diye suçlamıyoruz; en sık sebep botun
      // kanalda yönetici olmaması veya chatId'nin yanlış olmasıdır.
      request.log.error(
        { chatId: telegramBonus.chatId, telegramUserId, telegramError: membership.error },
        '[telegram] Üyelik sorgulanamadı — bot kanalda yönetici mi, chatId doğru mu?'
      );
      return reply.status(503).send({
        ok: false,
        message: 'Telegram üyeliğiniz şu anda doğrulanamıyor. Lütfen biraz sonra tekrar deneyin.',
        verificationFailed: true,
      });
    }
    if (!membership.isMember) {
      return reply.status(422).send({
        ok: false,
        message: `${telegramBonus.channelUsername || 'Telegram kanalına'} katılmanız gerekiyor.`,
        isMember: false,
      });
    }

    const grant = await chargeBonusToPlayer(
      login,
      telegramBonus.bonusId ? Number(telegramBonus.bonusId) : null,
      telegramBonus.bonusLabel,
      telegramBonus.amount,
      telegramBonus.assignmentValues || {},
    );
    claims.push({
      username: login,
      telegramUserId,
      ok: grant?.ok === true,
      message: grant?.message,
      createdAt: new Date().toISOString(),
    });
    await writeTelegramClaims(claims, tenantKey);

    return reply.status(grant?.ok === true ? 200 : 422).send({
      ok: grant?.ok === true,
      message: grant?.message,
      chargeStatus: grant,
    });
  });

  // Telegram Bot API'nin update'leri gönderdiği webhook. `/start <login>` mesajıyla
  // oyuncunun bonus panel giriş adını Telegram kullanıcı kimliğine bağlar.
  app.post('/telegram/webhook', async (request: any, reply) => {
    // Bu uç kimlik doğrulamasız erişilebilir olmak ZORUNDA (Telegram'ın panel
    // oturumu yok), dolayısıyla tek koruma paylaşılan sırdır. Sır tanımlı
    // değilse ucu açık bırakmak yerine kapatıyoruz: aksi halde herkes sahte
    // /start gönderip başka bir oyuncunun hesabını kendi Telegram kimliğine
    // bağlayabilir ve onun bonusunu alabilirdi.
    if (!config.telegram.webhookSecret) {
      request.log.error('[telegram] TELEGRAM_WEBHOOK_SECRET tanımlı değil; webhook kapalı.');
      return reply.status(503).send({ ok: false });
    }
    const provided = request.headers['x-telegram-bot-api-secret-token'];
    if (provided !== config.telegram.webhookSecret) {
      request.log.warn('[telegram] Webhook secret eşleşmedi; istek reddedildi.');
      return reply.status(401).send({ ok: false });
    }
    const message = request.body?.message;
    const text = String(message?.text || '').trim();
    const fromId = message?.from?.id;
    const chatId = message?.chat?.id;
    if (text.toLowerCase().startsWith('/start') && fromId && chatId) {
      const login = text.slice(6).trim();
      if (login) {
        const tenantKey = await resolveTenantKeyForRequest(request);
        await linkTelegramAccount(tenantKey, login, fromId, message?.from?.username || null);
        try {
          await sendTelegramMessage(chatId, `Hesabınız "${login}" kullanıcı adıyla bağlandı. Şimdi panelden Telegram bonusunuzu doğrulayabilirsiniz.`);
        } catch {
          // Mesaj gönderilemese de bağlama işlemi tamamlandı sayılır.
        }
      }
    }
    return reply.send({ ok: true });
  });

  app.get('/games/prediction-league', async (request: any, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const entries = await readPredictionEntries(tenantKey);
    const username = request.session?.bonusPanelUser?.login;
    return reply.send({
      ok: true,
      data: buildPredictionLeaguePayload(settings, entries, username)
    });
  });

  app.get('/admin/games/prediction-league/entries', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const entries = await readPredictionEntries(tenantKey);
    return reply.send({
      ok: true,
      data: buildPredictionLeaguePayload(settings, entries)
    });
  });

  app.post('/admin/games/prediction-league/settle', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ ok: false, message: 'Yetkisiz' });
    const period = request.body?.period === 'monthly' ? 'monthly' : 'weekly';
    const dryRun = request.body?.dryRun !== false;
    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const league = settings.predictionLeague || {};
    const campaignId = Number(period === 'monthly' ? league.monthlyRewardCampaignId : league.weeklyRewardCampaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return reply.status(422).send({ ok: false, message: `${period === 'monthly' ? 'Aylık' : 'Haftalık'} Lynon ödül kampanyası seçilmemiş.` });
    }

    const window = turkeyPeriodWindow(period);
    const entries = await readPredictionEntries(tenantKey);
    const matches = Array.isArray(league.matches) ? league.matches : [];
    const topCount = period === 'monthly' ? 1 : Math.max(1, Number(league.weeklyTopCount || 10));
    const winners = scorePredictionLeaderboard(entries, matches, window.from, window.to).slice(0, topCount);
    const settlements = await readPredictionSettlements(tenantKey);
    const alreadyGranted = new Set(settlements.filter((row: any) => row.ok === true).map((row: any) => row.key));
    const preview = winners.map((winner: any, index: number) => ({
      ...winner,
      rank: index + 1,
      key: `${period}:${window.key}:${winner.username}`,
      alreadyGranted: alreadyGranted.has(`${period}:${window.key}:${winner.username}`),
    }));

    if (dryRun) {
      return reply.send({ ok: true, dryRun: true, data: { period, periodKey: window.key, campaignId, winners: preview } });
    }

    const lockKey = `${tenantKey}:${period}:${window.key}`;
    if (predictionSettlementLocks.has(lockKey)) {
      return reply.status(409).send({ ok: false, message: 'Bu dönem ödül dağıtımı halen çalışıyor.' });
    }
    predictionSettlementLocks.add(lockKey);
    try {
      const amount = period === 'monthly' ? 500 : 200;
      const label = period === 'monthly' ? (league.monthlyRewardLabel || '500 TL Freebet') : (league.weeklyRewardLabel || '200 TL Freebet');
      const results: any[] = [];
      for (const winner of preview) {
        if (winner.alreadyGranted) {
          results.push({ ...winner, ok: true, skipped: true, message: 'Daha önce dağıtıldı.' });
          continue;
        }
        const assignmentValues = period === 'monthly' ? (league.monthlyRewardAssignmentValues || {}) : (league.weeklyRewardAssignmentValues || {});
        const grant = await chargeBonusToPlayer(winner.username, campaignId, label, amount, assignmentValues);
        const record = {
          ...winner,
          period,
          periodKey: window.key,
          campaignId,
          amount,
          ok: grant?.ok === true,
          message: grant?.message,
          grantedAt: new Date().toISOString(),
          grantedBy: user.username,
        };
        results.push(record);
        if (record.ok) {
          settlements.push(record);
          await writePredictionSettlements(settlements, tenantKey);
        }
      }
      return reply.send({ ok: results.every((row) => row.ok), data: { period, periodKey: window.key, campaignId, results } });
    } finally {
      predictionSettlementLocks.delete(lockKey);
    }
  });

  app.get('/admin/games/team-logo', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ ok: false, message: 'Yetkisiz' });
    const teamName = String(request.query?.name || '').trim();
    if (!teamName) return reply.status(400).send({ ok: false, message: 'Takım adı gerekli' });
    try {
      const imageUrl = await fetchWikipediaTeamLogo(teamName);
      if (!imageUrl) return reply.status(404).send({ ok: false, message: 'Wikipedia üzerinde logo bulunamadı' });
      return reply.send({ ok: true, imageUrl });
    } catch (err) {
      request.log.error({ err }, 'team-logo fetch error');
      return reply.status(502).send({ ok: false, message: 'Wikipedia sorgusu başarısız oldu' });
    }
  });

  app.post('/games/prediction-league/predict', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Tahmin göndermek için önce kullanıcı adınızı doğrulayın.' });
    }

    const { matchId, homeScore, awayScore } = request.body || {};
    const predictedHome = Number(homeScore);
    const predictedAway = Number(awayScore);

    if (!matchId || !Number.isInteger(predictedHome) || !Number.isInteger(predictedAway) || predictedHome < 0 || predictedAway < 0 || predictedHome > 99 || predictedAway > 99) {
      return reply.status(400).send({ ok: false, message: 'Geçerli bir skor tahmini girin.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const league = settings.predictionLeague || {};
    const match = Array.isArray(league.matches) ? league.matches.find((item: any) => item.id === matchId) : null;

    if (!league.isActive) {
      return reply.status(400).send({ ok: false, message: 'Skor tahmin ligi şu anda aktif değil.' });
    }

    if (!match) {
      return reply.status(404).send({ ok: false, message: 'Maç bulunamadı.' });
    }

    // Tahmin son tarihi maçın başlama saatinden AYRI.
    //
    // Önceden tek ölçüt startsAt idi: başlama saati geçen maç, yönetici
    // "açık" işaretlese bile tahmine kapanıyordu. predictionClosesAt
    // tanımlıysa son tarih odur; tanımlı değilse eski davranış (başlama
    // saati) sürüyor, yani mevcut maçlar etkilenmiyor.
    const kapanis = tahminKapanisZamani(match);
    const isClosed = match.status === 'closed'
      || match.status === 'finished'
      || (kapanis != null && kapanis <= Date.now());
    if (isClosed) {
      return reply.status(400).send({ ok: false, message: 'Bu maç için tahmin süresi kapandı.' });
    }

    const entries = await readPredictionEntries(tenantKey);
    const existingIndex = entries.findIndex((entry: any) => entry.username === bonusPanelUser.login && entry.matchId === matchId);
    const entry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: bonusPanelUser.login,
      matchId,
      homeScore: predictedHome,
      awayScore: predictedAway,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    await writePredictionEntries(entries, tenantKey);
    return reply.send({
      ok: true,
      data: buildPredictionLeaguePayload(settings, entries, bonusPanelUser.login)
    });
  });

  app.get('/games/daily-tasks/status', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Günlük görevleri görmek için önce kullanıcı adınızı doğrulayın.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const cfg = normalizeDailyTasks(settings);
    if (cfg.isActive === false) {
      return reply.send({ ok: true, data: { ...cfg, tasks: [], inactive: true } });
    }

    const { from, to } = dailyWindow(cfg.resetHour);
    const activity = await buildPlayerActivity(bonusPanelUser.login, from, to) as any;
    if (!activity.ok) return reply.status(activity.status || 500).send(activity);

    const claims = await readEngagementClaims(tenantKey);
    return reply.send({
      ok: true,
      data: buildDailyTasksPayload(settings, claims, activity, bonusPanelUser.login)
    });
  });

  app.post('/games/daily-tasks/claim', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Ödül almak için önce kullanıcı adınızı doğrulayın.' });
    }

    const { taskId } = request.body || {};
    if (!taskId) return reply.status(400).send({ ok: false, message: 'Görev seçilmedi.' });

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const cfg = normalizeDailyTasks(settings);
    const task = (cfg.tasks || []).find((item: any) => item.id === taskId && item.active !== false);
    if (!task || cfg.isActive === false) return reply.status(404).send({ ok: false, message: 'Görev bulunamadı veya aktif değil.' });

    const { from, to, dateKey } = dailyWindow(cfg.resetHour);
    const activity = await buildPlayerActivity(bonusPanelUser.login, from, to) as any;
    if (!activity.ok) return reply.status(activity.status || 500).send(activity);

    const value = metricValue(activity, task.metric);
    const target = Math.max(Number(task.target || 1), 1);
    if (value < target) {
      return reply.status(400).send({ ok: false, message: 'Bu görev henüz tamamlanmadı.', value, target });
    }

    const claims = await readEngagementClaims(tenantKey);
    const alreadyClaimed = claims.daily.some((claim: any) =>
      claim.username === bonusPanelUser.login && claim.dateKey === dateKey && claim.taskId === task.id
    );
    if (alreadyClaimed) return reply.status(400).send({ ok: false, message: 'Bu görev ödülü bugün zaten alındı.' });

    const reward = dailyTaskReward(task);
    const chargeStatus: any = await grantReward(bonusPanelUser.login, reward);
    if (!chargeStatus.ok) return reply.status(502).send({ ok: false, message: chargeStatus.message || 'Ödül yüklenemedi.', chargeStatus });

    claims.daily.push({
      id: `${dateKey}-${task.id}-${Date.now()}`,
      username: bonusPanelUser.login,
      taskId: task.id,
      taskTitle: task.title,
      dateKey,
      xp: Number(task.xp || 0),
      reward,
      claimedAt: new Date().toISOString(),
      chargeStatus
    });
    await writeEngagementClaims(claims, tenantKey);

    return reply.send({
      ok: true,
      chargeStatus,
      data: buildDailyTasksPayload(settings, claims, activity, bonusPanelUser.login)
    });
  });

  app.get('/games/battle-pass/status', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Sezon kartını görmek için önce kullanıcı adınızı doğrulayın.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const cfg = normalizeBattlePass(settings);
    if (cfg.isActive === false) {
      return reply.send({ ok: true, data: { ...cfg, levels: [], inactive: true } });
    }

    const { from, to } = seasonWindow(cfg);
    const activity = await buildPlayerActivity(bonusPanelUser.login, from, to) as any;
    if (!activity.ok) return reply.status(activity.status || 500).send(activity);

    const claims = await readEngagementClaims(tenantKey);
    return reply.send({
      ok: true,
      data: buildBattlePassPayload(settings, claims, activity, bonusPanelUser.login)
    });
  });

  app.post('/games/battle-pass/claim', async (request: any, reply) => {
    const bonusPanelUser = request.session?.bonusPanelUser;
    if (!bonusPanelUser?.login) {
      return reply.status(401).send({ ok: false, message: 'Ödül almak için önce kullanıcı adınızı doğrulayın.' });
    }

    const { level, track = 'free' } = request.body || {};
    const requestedLevel = Number(level);
    if (!Number.isInteger(requestedLevel) || requestedLevel <= 0) {
      return reply.status(400).send({ ok: false, message: 'Geçerli bir seviye seçin.' });
    }
    if (!['free', 'premium'].includes(String(track))) {
      return reply.status(400).send({ ok: false, message: 'Geçerli bir ödül hattı seçin.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const settings = await readGameSettings(tenantKey);
    const cfg = normalizeBattlePass(settings);
    if (cfg.isActive === false) return reply.status(400).send({ ok: false, message: 'Sezon kartı aktif değil.' });
    if (track === 'premium' && cfg.premiumEnabled === false) {
      return reply.status(400).send({ ok: false, message: 'Premium sezon hattı aktif değil.' });
    }

    const { from, to } = seasonWindow(cfg);
    const activity = await buildPlayerActivity(bonusPanelUser.login, from, to) as any;
    if (!activity.ok) return reply.status(activity.status || 500).send(activity);

    const claims = await readEngagementClaims(tenantKey);
    const payload = buildBattlePassPayload(settings, claims, activity, bonusPanelUser.login);
    const levelItem = payload.levels.find((item: any) => Number(item.level) === requestedLevel);
    if (!levelItem) return reply.status(404).send({ ok: false, message: 'Sezon seviyesi bulunamadı.' });
    if (!levelItem.unlocked) return reply.status(400).send({ ok: false, message: 'Bu seviye henüz açılmadı.' });

    const alreadyClaimed = claims.battlePass.some((claim: any) =>
      claim.username === bonusPanelUser.login &&
      claim.seasonId === payload.seasonId &&
      claim.level === requestedLevel &&
      claim.track === track
    );
    if (alreadyClaimed) return reply.status(400).send({ ok: false, message: 'Bu sezon ödülü zaten alındı.' });

    const reward = levelReward(levelItem, track);
    const chargeStatus: any = await grantReward(bonusPanelUser.login, reward);
    if (!chargeStatus.ok) return reply.status(502).send({ ok: false, message: chargeStatus.message || 'Ödül yüklenemedi.', chargeStatus });

    claims.battlePass.push({
      id: `${payload.seasonId}-${requestedLevel}-${track}-${Date.now()}`,
      username: bonusPanelUser.login,
      seasonId: payload.seasonId,
      level: requestedLevel,
      track,
      reward,
      claimedAt: new Date().toISOString(),
      chargeStatus
    });
    await writeEngagementClaims(claims, tenantKey);

    return reply.send({
      ok: true,
      chargeStatus,
      data: buildBattlePassPayload(settings, claims, activity, bonusPanelUser.login)
    });
  });

}
