import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGamesConfigCached, readCachedGamesConfig } from './lobbyConfigCache';

export type LobbyPageId =
  | 'bonus'
  | 'wheel'
  | 'scratch'
  | 'prediction'
  | 'daily-tasks'
  | 'battle-pass'
  | 'tournament'
  | 'loyalty'
  | 'millionaires'
  | 'vip'
  | 'partner'
  | 'call-me';

export type LobbyPageContent = {
  id: LobbyPageId;
  label: string;
  path: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryButton: string;
  secondaryButton: string;
  emptyTitle: string;
  emptyDescription: string;
  loadingText: string;
  unavailableTitle: string;
  unavailableDescription: string;
  /**
   * Bakim modu. Lobideki karti gizlemek (quickAccess[].enabled=false)
   * yalnizca navigasyonu gizler; oyuncu sayfaya dogrudan URL ile hala
   * ulasabilir. Bu bayrak sayfanin KENDISINI kapatir: aciksa liste yerine
   * `unavailableTitle`/`unavailableDescription` gosterilir.
   */
  maintenanceMode?: boolean;
  successTitle: string;
  successDescription: string;
  successButton: string;
  formTitle: string;
  formDescription: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  submitButton: string;
  /**
   * Sayfaya özel vurgu rengi (#rrggbb). Boşsa lobinin global accent rengi kullanılır.
   * Ortak iskeleti bozmadan her sayfaya kendi kimliğini vermek için.
   */
  accentColor?: string;
  extra: Record<string, string | string[]>;
};

export type LobbyPageExtraField = {
  key: string;
  label: string;
  type?: 'text' | 'lines';
  placeholder?: string;
};

export const LOBBY_PAGE_ORDER: LobbyPageId[] = [
  'bonus',
  'wheel',
  'scratch',
  'prediction',
  'daily-tasks',
  'battle-pass',
  'tournament',
  'loyalty',
  'millionaires',
  'vip',
  'partner',
  'call-me'
];

export const DEFAULT_LOBBY_PAGE_CONTENTS: Record<LobbyPageId, LobbyPageContent> = {
  bonus: {
    id: 'bonus',
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
    maintenanceMode: false,
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
      modalCloseLabel: 'Modalı kapat',
      detailCloseLabel: 'Detayları kapat',
      detailTitleSuffix: 'detaylarını görüntüle',
      requestAriaSuffix: 'talep et',
      closedAriaSuffix: 'şu an kapalı',
      checkingText: 'Hesap kontrol ediliyor...',
      accountStatusLabel: 'Hesap Durumu',
      balanceLabel: 'Bakiye',
      verifiedText: 'Doğrulandı',
      rulesOkText: 'Hesabınız bu bonus için uygun görünüyor.',
      rulesFailText: 'Bu bonus şu anda hesabınız için uygun görünmüyor.',
      ruleViolationText: 'Bu koşul henüz tamamlanmamış.',
      submitLoading: 'Talep Gönderiliyor...',
      submitBlocked: 'Şu anda uygun değil',
      usernamePrompt: 'Onaylamak için kullanıcı adınızı yazın.',
      conditionsTitle: 'Koşullar',
      detailEmptyText: 'Detay bulunamadı.',
      genericTag: 'Genel Bonus',
      userNotFoundError: 'Kullanıcı adı bulunamadı.',
      accountError: 'Hesap bilgileri alınamadı.',
      connectionError: 'Sistem bağlantı hatası.',
      chargeError: 'Bonus tanımlanamadı.',
      submitError: 'Bonus talebi gönderilemedi.'
    }
  },
  wheel: {
    id: 'wheel',
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
    extra: {
      codePlaceholder: 'Varsa Çark Kodunuz',
      spinAria: 'Çarkı çevir',
      spinningAria: 'Çark dönüyor',
      userNotFoundError: 'Kullanıcı adı bulunamadı.',
      connectionError: 'Bağlantı hatası.',
      playError: 'Hata oluştu.',
      sessionError: 'Döndürme sırasında bir hata oluştu. Oturumunuz süresi dolmuş olabilir.',
      bonusFailedText: 'Otomatik ekleme başarısız.'
    }
  },
  scratch: {
    id: 'scratch',
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
    extra: {
      gridLabel: 'Kazı-kazan kartı',
      progressTemplate: 'Bütün kareleri kazıyın ({count}/9)',
      revealedCellTemplate: 'Sembol: {symbol}',
      unrevealedCellTemplate: 'Kare {index}: kazınmadı',
      userNotFoundError: 'Kullanıcı adı bulunamadı.',
      connectionError: 'Bağlantı hatası.',
      startError: 'Oyun başlatılamadı.',
      playError: 'Hata oluştu.',
      bonusFailedText: 'Ekleme başarısız.'
    }
  },
  prediction: {
    id: 'prediction',
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
    extra: {
      matchesTitle: 'Tahmin maçları',
      openStatus: 'Tahmine açık',
      finishedStatus: 'Sonuçlandı',
      closedStatus: 'Kapalı',
      submitAria: 'Tahmini gönder',
      submitError: 'Tahmin kaydedilemedi.'
    }
  },
  'daily-tasks': {
    id: 'daily-tasks',
    label: 'Günlük Görevler',
    path: '/gorevler',
    eyebrow: 'Görev Merkezi',
    title: 'Günlük Görevler',
    subtitle: 'Günlük aktiviteleri tamamlayın, XP ve ödülleri toplayın.',
    primaryButton: 'Sezon kartı',
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
    extra: {
      claimButton: 'Ödülü Al',
      claimedButton: 'Alındı',
      progressLabel: 'İlerleme'
    }
  },
  'battle-pass': {
    id: 'battle-pass',
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
    extra: {
      freeTrack: 'Ücretsiz',
      premiumTrack: 'Premium',
      taskXpLabel: 'Görev',
      claimButton: 'Ödülü Al',
      claimedButton: 'Alındı'
    }
  },
  tournament: {
    id: 'tournament',
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
    extra: {
      liveLabel: 'Anlık',
      tournamentSuffix: 'TURNUVA',
      prizePoolTitle: 'ÖDÜL HAVUZU',
      updateLabel: 'GÜNCELLEME',
      dailyLabel: 'GÜNLÜK',
      weeklyLabel: 'HAFTALIK',
      monthlyLabel: 'AYLIK'
    }
  },
  loyalty: {
    id: 'loyalty',
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
    extra: {
      marketTab: 'Market',
      inventoryTab: 'Envanter'
    }
  },
  millionaires: {
    id: 'millionaires',
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
    extra: {
      backButton: 'Lobiye Dön',
      amountLabel: 'Kazanç',
      playerLabel: 'Oyuncu'
    }
  },
  vip: {
    id: 'vip',
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
    extra: {
      tiersTitle: 'Kademenizi seçin',
      faqTitle: 'Sık sorulan sorular',
      tiersButton: 'Seviyeleri gör',
      tierApplyButton: 'Bu seviyeye başvur',
      namePlaceholder: 'Ad Soyad',
      emailPlaceholder: 'E-posta',
      phonePlaceholder: 'Telefon'
    }
  },
  partner: {
    id: 'partner',
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
    extra: {
      channelLabel: 'KANAL/SAYFA LİNKİ',
      channelPlaceholder: 'https://...',
      audienceLabel: 'TAKİPÇİ / TRAFİK',
      audiencePlaceholder: 'Örn: 50K',
      contactLabel: 'İLETİŞİM',
      contactPlaceholder: '@KullaniciAdi',
      messageLabel: 'MESAJ',
      messagePlaceholder: 'Belirtmek istediğiniz detaylar...'
    }
  },
  'call-me': {
    id: 'call-me',
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
    extra: {
      phoneLabel: 'TELEFON',
      phonePlaceholder: 'Örn: 05xx xxx xx xx',
      reasonLabel: 'KONU'
    }
  }
};

export const LOBBY_PAGE_EXTRA_FIELDS: Partial<Record<LobbyPageId, LobbyPageExtraField[]>> = {
  bonus: [
    { key: 'categories', label: 'Kategoriler', type: 'lines', placeholder: 'Her satıra bir kategori' },
    { key: 'cardDescriptionTemplate', label: 'Kart açıklama şablonu', placeholder: '{bonus} değişkenini kullanabilirsiniz' },
    { key: 'closedButton', label: 'Kapalı butonu' },
    { key: 'checkingText', label: 'Hesap kontrol metni' },
    { key: 'accountStatusLabel', label: 'Hesap durumu etiketi' },
    { key: 'balanceLabel', label: 'Bakiye etiketi' },
    { key: 'verifiedText', label: 'Doğrulandı metni' },
    { key: 'rulesOkText', label: 'Kurallar uygun metni' },
    { key: 'rulesFailText', label: 'Kurallar başarısız metni' },
    { key: 'submitLoading', label: 'Talep gönderiliyor metni' },
    { key: 'submitBlocked', label: 'Kural engeli butonu' },
    { key: 'usernamePrompt', label: 'Kullanıcı adı uyarısı' },
    { key: 'conditionsTitle', label: 'Koşullar başlığı' },
    { key: 'detailEmptyText', label: 'Detay yok metni' }
  ],
  wheel: [
    { key: 'codePlaceholder', label: 'Kod alanı placeholder' },
    { key: 'spinningAria', label: 'Dönüyor erişilebilirlik metni' },
    { key: 'bonusFailedText', label: 'Bonus ekleme hata metni' }
  ],
  scratch: [
    { key: 'gridLabel', label: 'Kart erişilebilirlik adı' },
    { key: 'progressTemplate', label: 'Kazıma ilerleme şablonu', placeholder: '{count}/9' },
    { key: 'bonusFailedText', label: 'Bonus ekleme hata metni' }
  ],
  prediction: [
    { key: 'matchesTitle', label: 'Maç listesi başlığı' },
    { key: 'openStatus', label: 'Açık statü metni' },
    { key: 'finishedStatus', label: 'Sonuçlandı statü metni' },
    { key: 'closedStatus', label: 'Kapalı statü metni' }
  ],
  'daily-tasks': [
    { key: 'claimButton', label: 'Ödül al butonu' },
    { key: 'claimedButton', label: 'Alındı butonu' },
    { key: 'progressLabel', label: 'İlerleme etiketi' }
  ],
  'battle-pass': [
    { key: 'freeTrack', label: 'Ücretsiz bölüm' },
    { key: 'premiumTrack', label: 'Premium bölüm' },
    { key: 'taskXpLabel', label: 'Görev XP etiketi' },
    { key: 'claimButton', label: 'Ödül al butonu' },
    { key: 'claimedButton', label: 'Alındı butonu' }
  ],
  tournament: [
    { key: 'liveLabel', label: 'Canlı veri etiketi' },
    { key: 'tournamentSuffix', label: 'Turnuva başlık eki' },
    { key: 'prizePoolTitle', label: 'Ödül havuzu başlığı' },
    { key: 'updateLabel', label: 'Güncelleme etiketi' },
    { key: 'dailyLabel', label: 'Günlük sekme' },
    { key: 'weeklyLabel', label: 'Haftalık sekme' },
    { key: 'monthlyLabel', label: 'Aylık sekme' }
  ],
  loyalty: [
    { key: 'marketTab', label: 'Market tabı' },
    { key: 'inventoryTab', label: 'Envanter tabı' }
  ],
  millionaires: [
    { key: 'backButton', label: 'Lobi dönüş butonu' },
    { key: 'amountLabel', label: 'Kazanç etiketi' },
    { key: 'playerLabel', label: 'Oyuncu etiketi' }
  ],
  vip: [
    { key: 'tiersTitle', label: 'Kademeler başlığı' },
    { key: 'faqTitle', label: 'SSS başlığı' },
    { key: 'tiersButton', label: 'Seviyeler butonu' },
    { key: 'tierApplyButton', label: 'Kademe başvuru butonu' },
    { key: 'namePlaceholder', label: 'Ad soyad placeholder' },
    { key: 'emailPlaceholder', label: 'E-posta placeholder' },
    { key: 'phonePlaceholder', label: 'Telefon placeholder' }
  ],
  partner: [
    { key: 'channelLabel', label: 'Kanal label' },
    { key: 'channelPlaceholder', label: 'Kanal placeholder' },
    { key: 'audienceLabel', label: 'Kitle label' },
    { key: 'audiencePlaceholder', label: 'Kitle placeholder' },
    { key: 'contactLabel', label: 'İletişim label' },
    { key: 'contactPlaceholder', label: 'İletişim placeholder' },
    { key: 'messageLabel', label: 'Mesaj label' },
    { key: 'messagePlaceholder', label: 'Mesaj placeholder' }
  ],
  'call-me': [
    { key: 'phoneLabel', label: 'Telefon label' },
    { key: 'phonePlaceholder', label: 'Telefon placeholder' },
    { key: 'reasonLabel', label: 'Konu label' }
  ]
};

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function normalizeExtra(defaults: Record<string, string | string[]>, source: unknown) {
  const sourceExtra = source && typeof source === 'object' ? source as Record<string, unknown> : {};
  const next: Record<string, string | string[]> = {};

  Object.entries(defaults).forEach(([key, fallback]) => {
    const value = sourceExtra[key];
    if (Array.isArray(fallback)) {
      next[key] = Array.isArray(value)
        ? value.map(String).filter(Boolean)
        : typeof value === 'string'
          ? value.split('\n').map((line) => line.trim()).filter(Boolean)
          : fallback;
      return;
    }
    next[key] = asString(value, fallback);
  });

  Object.entries(sourceExtra).forEach(([key, value]) => {
    if (key in next) return;
    if (Array.isArray(value)) {
      next[key] = value.map(String).filter(Boolean);
      return;
    }
    if (typeof value === 'string') next[key] = value;
  });

  return next;
}

export function normalizeLobbyPageContent(pageId: LobbyPageId, page?: Partial<LobbyPageContent>): LobbyPageContent {
  const fallback = DEFAULT_LOBBY_PAGE_CONTENTS[pageId];
  const source = page && typeof page === 'object' ? page : {};

  return {
    ...fallback,
    ...source,
    id: pageId,
    label: asString(source.label, fallback.label),
    path: asString(source.path, fallback.path),
    eyebrow: asString(source.eyebrow, fallback.eyebrow),
    title: asString(source.title, fallback.title),
    subtitle: asString(source.subtitle, fallback.subtitle),
    primaryButton: asString(source.primaryButton, fallback.primaryButton),
    secondaryButton: asString(source.secondaryButton, fallback.secondaryButton),
    emptyTitle: asString(source.emptyTitle, fallback.emptyTitle),
    emptyDescription: asString(source.emptyDescription, fallback.emptyDescription),
    loadingText: asString(source.loadingText, fallback.loadingText),
    unavailableTitle: asString(source.unavailableTitle, fallback.unavailableTitle),
    unavailableDescription: asString(source.unavailableDescription, fallback.unavailableDescription),
    maintenanceMode: source.maintenanceMode === true,
    successTitle: asString(source.successTitle, fallback.successTitle),
    successDescription: asString(source.successDescription, fallback.successDescription),
    successButton: asString(source.successButton, fallback.successButton),
    formTitle: asString(source.formTitle, fallback.formTitle),
    formDescription: asString(source.formDescription, fallback.formDescription),
    usernameLabel: asString(source.usernameLabel, fallback.usernameLabel),
    usernamePlaceholder: asString(source.usernamePlaceholder, fallback.usernamePlaceholder),
    submitButton: asString(source.submitButton, fallback.submitButton),
    accentColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(source.accentColor ?? '').trim())
      ? String(source.accentColor).trim()
      : '',
    extra: normalizeExtra(fallback.extra, source.extra)
  };
}

export function normalizeLobbyPages(pages?: Record<string, Partial<LobbyPageContent>>): Record<LobbyPageId, LobbyPageContent> {
  return LOBBY_PAGE_ORDER.reduce((acc, pageId) => {
    acc[pageId] = normalizeLobbyPageContent(pageId, pages?.[pageId]);
    return acc;
  }, {} as Record<LobbyPageId, LobbyPageContent>);
}

export function lobbyExtraText(page: LobbyPageContent, key: string, fallback = '') {
  const value = page.extra?.[key];
  return typeof value === 'string' ? value : fallback;
}

export function lobbyExtraLines(page: LobbyPageContent, key: string, fallback: string[] = []) {
  const value = page.extra?.[key];
  return Array.isArray(value) ? value : fallback;
}

export function renderLobbyTemplate(template: string, values: Record<string, string | number | undefined>) {
  return Object.entries(values).reduce((text, [key, value]) => (
    text.split(`{${key}}`).join(String(value ?? ''))
  ), template);
}

export function useLobbyPageContent(pageId: LobbyPageId) {
  const query = useQuery({
    queryKey: ['games-config', 'lobby-pages'],
    queryFn: fetchGamesConfigCached,
    staleTime: 5 * 60 * 1000
  });

  // Sorgu henüz bitmediyse VEYA hata verdiyse son bilinen içerikle boya.
  const lobby = query.data?.data?.lobby ?? readCachedGamesConfig()?.data?.lobby;

  const content = useMemo(() => (
    normalizeLobbyPageContent(pageId, lobby?.pages?.[pageId])
  ), [pageId, lobby?.pages]);

  return {
    content,
    isLoading: query.isLoading
  };
}
