export type NarcosBonusCategory = 'deposit' | 'loss' | 'gift' | 'sport' | 'wheel';

export interface NarcosBonusDefinition {
  key: string;
  title: string;
  description: string;
  category: NarcosBonusCategory;
  campaignTitle: string;
  templateId?: number;
  minimumDeposit?: number;
  maximumBonus?: number;
  bonusPercent?: number;
  validityDays?: number;
  tags: string[];
  rules: Record<string, unknown>;
  detailHtml: string;
  image?: string;
}

const detail = (items: string[]) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;

export const NARCOS_BONUSES: NarcosBonusDefinition[] = [
  {
    key: 'trial-250', title: '250 TL Deneme Bonusu', campaignTitle: '250 TL Deneme Bonusu', category: 'gift', templateId: 38,
    description: 'Yatırımsız slot deneyimi için tek seferlik 250 TL.', validityDays: 3, tags: ['Tek Seferlik', 'Slot', '10x Çevrim'],
    rules: { oneTimeOnly: true, noDepositRequired: true, wageringMultiplier: 10, maxPayout: 1000, balanceTarget: 10000, allowedGames: ['Gates of Olympus 1000', 'Sweet Bonanza 1000'], assignmentValues: { BonusMoneyAmount: 250 } },
    detailHtml: detail(['Yalnızca bir kez; daha önce finansal işlem yapanlar yararlanamaz.', 'Gates of Olympus 1000 ve Sweet Bonanza 1000 için geçerlidir.', '3 gün içinde 10x çevrim tamamlanmalıdır.', 'Maksimum çekim 1.000 TL.']),
  },
  {
    key: 'risk-free-first', title: '%100 Risksiz İlk Yatırım', campaignTitle: '%100 Risksiz İlk Yatırım', category: 'loss', templateId: 38,
    description: 'İlk yatırım kaybında, 2.000 TL’ye kadar %100 iade.', minimumDeposit: 250, maximumBonus: 2000, bonusPercent: 100, validityDays: 3, tags: ['İlk Yatırım', 'Kayıp Bonusu', 'Casino + Spor'],
    rules: { firstDepositOnly: true, lossBonus: true, minimumDeposit: 250, maximumBonus: 2000, casinoWagering: 5, sportWagering: 3, minSportOdds: 1.5, minSportSelections: 2, maxCashoutMultiplier: 10 },
    detailHtml: detail(['Yeni üyelerin ilk, en az 250 TL yatırımı için geçerlidir.', 'Kayıp sonrası en fazla 2.000 TL tutara %100 iade uygulanır.', 'Casino/slotta 5x, sporda 3x çevrim; sporda en az 2 maç ve 1.50 oran.', 'Maksimum çekim, eklenen bonusun 10 katıdır.']),
  },
  {
    key: 'first-deposit-double', title: 'İlk Yatırımına 2 Katıyla Başla', campaignTitle: 'İlk Yatırımına 2 Katıyla Başla', category: 'deposit', templateId: 88,
    description: 'İlk yatırımda %100 başlangıç bakiyesi.', minimumDeposit: 250, bonusPercent: 100, validityDays: 3, tags: ['İlk Yatırım', '%100', 'Casino + Spor'],
    rules: { firstDepositOnly: true, minimumDeposit: 250, bonusPercent: 100, casinoWagering: 2, sportWagering: 3, minSportOdds: 1.65, minSportSelections: 2, maxCashoutMultiplier: 8 },
    detailHtml: detail(['250 / 500 / 750 / 1.000 TL yatırımlara sırasıyla 500 / 1.000 / 1.500 / 2.000 TL başlangıç bakiyesi.', 'Slot çevrimi anapara + bonusun 2 katı; sporda 3 katı.', 'Canlı casino dahil değildir; sporda Futbol, Basketbol ve Voleybol geçerlidir.', 'Çekim tutarı anaparanın 5–8 katı aralığındadır.']),
  },
  {
    key: 'casino-deposit-20', title: '%20 Casino Yatırım Bonusu', campaignTitle: '%20 Casino Yatırım Bonusu', category: 'deposit', templateId: 88,
    description: '500 TL ve üzeri yatırımlarda %20 casino bonusu.', minimumDeposit: 500, maximumBonus: 5000, bonusPercent: 20, tags: ['%20', 'Casino', 'Sınırsız'],
    rules: { minimumDeposit: 500, maximumBonus: 5000, bonusPercent: 20, casinoWagering: 1, noOpenBets: true, unlimitedDaily: true },
    detailHtml: detail(['Tüm ödeme yöntemlerinde minimum 500 TL yatırımlarda geçerlidir.', 'Yatırım ve bonusun casino alanında 1x çevrimi gerekir.', 'Tek seferde en fazla 5.000 TL bonus.', 'Açık bahsi olan veya yatırımı kullanan oyuncular yararlanamaz.']),
  },
  {
    key: 'sport-deposit-15', title: '%15 Spor Yatırım Bonusu', campaignTitle: '%15 Spor Yatırım Bonusu', category: 'sport', templateId: 78,
    description: '500 TL ve üzeri yatırımlarda %15 spor bonusu.', minimumDeposit: 500, maximumBonus: 5000, bonusPercent: 15, tags: ['%15', 'Spor', 'Sınırsız'],
    rules: { minimumDeposit: 500, maximumBonus: 5000, bonusPercent: 15, sportWagering: 1, minSportOdds: 1.3, sports: ['Futbol', 'Basketbol', 'Voleybol'], noOpenBets: true, unlimitedDaily: true },
    detailHtml: detail(['Minimum yatırım 500 TL, maksimum bonus 5.000 TL.', 'Anapara ve bonus için 1x çevrim, minimum 1.30 oran.', 'Futbol, Basketbol ve Voleybol bahisleri geçerlidir.', 'Açık kupon varken veya yatırım kullanıldıktan sonra verilemez.']),
  },
  {
    key: 'loss-30', title: '%30 Kayıp Bonusu', campaignTitle: '%30 Kayıp Bonusu', category: 'loss', templateId: 38,
    description: 'Son yatırımı kaybeden oyunculara kademeli iade.', validityDays: 1, tags: ['Kayıp Bonusu', '1x Çevrim', '24 Saat'],
    rules: { lossBonus: true, requestWithinHours: 24, balanceBelow: 10, noOpenBets: true, tiers: [{ from: 50, to: 4999, percent: 20 }, { from: 5000, to: 49999, percent: 25 }, { from: 50000, percent: 30 }], wageringMultiplier: 1, minSportOdds: 1.3, maxCashoutMultiplier: 20 },
    detailHtml: detail(['50–4.999 TL kayıpta %20, 5.000–49.999 TL’de %25, 50.000 TL ve üzerinde %30 iade.', 'Talep, yatırımı takip eden 24 saat içinde yapılır.', 'Talepte bakiye 10 TL altında ve açık bahis/casino turu olmamalıdır.', 'Casino/canlı casino veya minimum 1.30 oranlı spor bahislerinde 1x çevrim; maksimum kazanç 20x.']),
  },
  {
    key: 'deposit-freespin', title: 'Her Yatırıma Freespin', campaignTitle: 'Her Yatırıma Freespin!', category: 'gift', templateId: 76,
    description: '500 TL üzeri yatırımlarda Gates of Olympus Super Scatter freespin.', minimumDeposit: 500, maximumBonus: 20000, bonusPercent: 10, validityDays: 7, tags: ['Freespin', 'Gates of Olympus', '7 Gün'],
    rules: { minimumDeposit: 500, bonusPercent: 10, maximumDepositForBenefit: 20000, spinValue: 2, game: 'Gates of Olympus Super Scatter', validityDays: 7, noWagering: true },
    detailHtml: detail(['500 TL ve üzeri yatırımlarda, yatırımın %10’u değerinde freespin.', 'Spin değeri 2 TL; fayda hesabı en fazla 20.000 TL yatırımla sınırlı.', 'Yalnızca Gates of Olympus Super Scatter oyununda kullanılabilir.', '7 gün içinde kullanılmayan freespinler iptal olur.']),
  },
  {
    key: 'wednesday-happy-days', title: '%400 Çarşamba Happy Days', campaignTitle: '%400 Çarşamba Happy Days', category: 'deposit', templateId: 88,
    description: 'Çarşamba günü, sıralı yatırımlarda %20–%100 kademeli bonus.', bonusPercent: 100, validityDays: 1, tags: ['Çarşamba', 'Kademeli', '15x Çevrim'],
    rules: { dayOfWeek: 'Wednesday', tiers: [20, 40, 60, 80, 100], casinoWagering: 15, validityDays: 1, maxCashoutMultiplier: 10, liveCasino: true },
    detailHtml: detail(['1–5. yatırımlarda sırayla %20, %40, %60, %80 ve %100 bonus.', 'Önceki bonusla çekim yapılması veya bakiyenin kaybedilmesi sonrası sıradaki kademe açılır.', 'Slot ve canlı casinoda bonus tutarının 15x çevrimi, süre 24 saattir.', 'Maksimum çekim bonus tutarının 10 katıdır.']),
  },
  {
    key: 'weekly-loss-5', title: '%5 Haftalık Kayıp Bonusu', campaignTitle: '%5 Haftalık Kayıp Bonusu', category: 'loss', templateId: 109,
    description: 'Pazartesi günleri, önceki haftanın net kaybı için %5 bonus.', tags: ['Haftalık', 'Pazartesi', 'Spor'],
    rules: { weeklyOnce: true, requestDay: 'Monday', minimumWeeklyNetLoss: 1000, bonusPercent: 5, sports: ['Futbol', 'Basketbol', 'Voleybol'], wageringMultiplier: 1, minSportOdds: 1.6, maxCashoutMultiplier: 10, maximumCashout: 500000 },
    detailHtml: detail(['Sadece Pazartesi günü talep edilebilir.', 'Önceki Pazartesi–Pazar döneminde en az 1.000 TL net kayıp gerekir.', 'Futbol, Basketbol ve Voleybol bahislerinde minimum 1.60 oranla 1x çevrim.', 'Bonusun 10 katına kadar çekim; toplam nihai çekim limiti 500.000 TL.']),
  },
  {
    key: 'fourth-deposit-gift', title: "4. Yatırımın Patron'dan Hediye!", campaignTitle: '4. Yatırımın Bizden Hediye!', category: 'gift', templateId: 38,
    description: 'Aynı gün üç kayıp sonrası dördüncü yatırım hediyesi.', minimumDeposit: 500, maximumBonus: 2000, tags: ['Hediye', '4. Yatırım', '10x Çevrim'],
    rules: { consecutiveLossDeposits: 3, minimumDeposit: 500, minimumBonus: 100, maximumBonus: 2000, casinoWagering: 10, sportWagering: 5, crashWagering: 25, minSportOdds: 1.5, minSportSelections: 2, maxCashoutMultiplier: 10 },
    detailHtml: detail(['00:00–23:59 arasında üç ardışık kayıptan sonra canlı destekten talep edilir.', 'Her yatırım en az 500 TL olmalı; son üç yatırımın ortalaması hediye edilir.', 'Bonus 100–2.000 TL aralığındadır.', 'Slot/canlı casino 10x, spor 5x, crash oyunları 25x çevrim.']),
  },
  {
    key: 'medellin-wheel', title: 'Medellin Şans Çarkı', campaignTitle: 'Medellin Şans Çarkı', category: 'wheel', templateId: 42,
    description: '1.000 TL ve üzeri yatırımda Medellín ödülleri için çark hakkı.', minimumDeposit: 1000, tags: ['Çark', 'Freespin', 'Nakit + Ödül'],
    rules: { minimumDeposit: 1000, wheel: true, prizes: ['100 FS Sweet Bonanza (1 TL)', '150 FS Gates of Olympus (1 TL)', '150 / 250 / 500 / 10.000 / 50.000 TL nakit', '500 TL Freebet', 'Apple Watch Ultra 3', 'iPhone 17 Pro Max 1TB'] },
    detailHtml: detail(['Çark hakkı minimum 1.000 TL yatırım sonrası tanımlanır.', 'Nakit ödüller çevrimsizdir; freespin ve freebet ödülleri ilgili oyun/kupon koşullarıyla tanımlanır.', 'Fiziksel ödüller Backoffice onayı ve kullanıcı iletişimi gerektirir.']),
  },  {
    key: 'five-x-seven-x', title: '5X Yap 7X Çek!', campaignTitle: '5X YAP 7X ÇEK!', category: 'deposit', templateId: 38,
    description: '1.000 TL yatırımla, Pragmatic Play slotlarında 7.000 TL’ye kadar özel yatırım bonusu.', minimumDeposit: 1000, maximumBonus: 7000, validityDays: 1, tags: ['1.000 TL Yatırım', 'Pragmatic Play', 'Günlük 1 Talep'],
    rules: { minimumDeposit: 1000, minDepositAmount: 1000, checkLastTransactionIsDeposit: true, checkSingleInvestmentUsage: true, checkSameDayUsage: true, perDayLimit: 1, allowedProviders: ['Pragmatic Play'], allowedGameTypes: ['slot'], wageringMultiplier: 0, maxPayoutFixed: 7000, assignmentValues: { BonusMoneyAmount: 1 } },
    detailHtml: detail(['Yalnızca 1.000 TL yatırımlar için, yatırım kullanılmadan önce Bonus Talep ekranından istenir.', '1 TL sembolik bonus bakiyesi tanımlanır; Pragmatic Play slot oyunlarında geçerlidir.', 'Çevrim şartı yoktur; maksimum çekim tutarı 7.000 TL’dir.', 'Diğer yatırım/kayıp bonuslarıyla birlikte kullanılamaz; aynı kişi/IP/adres/telefon için günde bir kez uygulanır.']),
  },
  {
    key: 'eight-x-ten-x', title: '8X Yap 10X Çek!', campaignTitle: '8X YAP 10X ÇEK!', category: 'deposit', templateId: 38,
    description: '1.000 TL yatırımla, Pragmatic Play slotlarında 10.000 TL’ye kadar özel yatırım bonusu.', minimumDeposit: 1000, maximumBonus: 10000, validityDays: 1, tags: ['1.000 TL Yatırım', 'Pragmatic Play', 'Günlük 1 Talep'],
    rules: { minimumDeposit: 1000, minDepositAmount: 1000, checkLastTransactionIsDeposit: true, checkSingleInvestmentUsage: true, checkSameDayUsage: true, perDayLimit: 1, allowedProviders: ['Pragmatic Play'], allowedGameTypes: ['slot'], wageringMultiplier: 0, maxPayoutFixed: 10000, assignmentValues: { BonusMoneyAmount: 1 } },
    detailHtml: detail(['Yalnızca 1.000 TL yatırımlar için, yatırım kullanılmadan önce Bonus Talep ekranından istenir.', '1 TL sembolik bonus bakiyesi tanımlanır; Pragmatic Play slot oyunlarında geçerlidir.', 'Çevrim şartı yoktur; maksimum çekim tutarı 10.000 TL’dir.', 'Diğer yatırım/kayıp bonuslarıyla birlikte kullanılamaz; aynı kişi/IP/adres/telefon için günde bir kez uygulanır.']),
  },  {
    key: 'birthday', title: 'Doğum Günü Bonusu', campaignTitle: 'DOĞUM GÜNÜNÜZ KUTLU OLSUN!', category: 'gift', templateId: 65,
    description: 'Doğum günü ve takip eden üç gün için kişiye özel nakit hediye.', validityDays: 3, tags: ['Doğum Günü', 'Nakit', '1x Çevrim'],
    rules: { birthdayOnly: true, verifiedProfileRequired: true, depositInLast12Months: true, validityDays: 3, cashBalance: true, wageringMultiplier: 1 },
    detailHtml: detail(['Son 12 ayda en az bir başarılı yatırım ve doğrulanmış profil gereklidir.', 'Doğum gününde veya takip eden 3 gün içinde canlı destekten talep edilir.', 'Bonus nakit bakiye olarak geçer; spor veya casinoda 1x kullanım gerekir.', 'Üst kazanç limiti yoktur.']),
  },
];

const normalized = (value: string) => value.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/g, ' ').trim();

export function findNarcosBonusByCampaignTitle(title: string) {
  const target = normalized(title);
  return NARCOS_BONUSES.find((bonus) => {
    const name = normalized(bonus.campaignTitle);
    return target === name || target.includes(name) || name.includes(target);
  });
}



