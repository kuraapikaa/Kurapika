/**
 * withdrawalEngine'den ayrılmış risk analizi modülü.
 * Hesap bayrakları, test hesabı, IP çakışması, anormallik tespiti vb.
 */
import { findPlayedEasyTurnoverGames } from '../lib/easyTurnoverGames.js';
import { parseDateToTime } from './accountSnapshotService.js';
import type { RulesConfig } from './rulesService.js';
import type { AccountSnapshot, ChecklistItem, RuleSetResult } from './withdrawalEngine.js';
import type { TransactionTypeSummary, BCBonus, BCProfileTransaction } from '../types/betconstruct.js';

/** Profil işlemlerinde yatırım olarak kabul edilen doküman türleri. */
const DEPOSIT_TYPE_KEYS = ['Yatırım', 'Deposit', 'Yatırım Talebi Ödemesi'];

function getDepositSum(byType: Record<string, TransactionTypeSummary>): number {
  return DEPOSIT_TYPE_KEYS.reduce((sum, key) => sum + (byType[key]?.totalAmount ?? 0), 0);
}

/** Risk analizi: bayraklar, test hesabı, işlem sıklığı, yatırım/çekim oranı, yeni hesap, anormallik. */
export function evaluateRiskAnalysis(account: AccountSnapshot, specs: RulesConfig = { PROMO_SPECS: {}, PROMO_TITLE_SPECS: {} }): RuleSetResult {
  const items: ChecklistItem[] = [];
  const txCount = Number((account as any).profileTransactionsCount ?? 0);
  const byType = (account.profileTransactionsByType as Record<string, TransactionTypeSummary>) ?? {};
  const totalDeposits = account.totalDeposits ?? 0;
  const withdrawalReq = byType['Çekim Talebi'] ?? byType['Withdrawal Request'];
  const depositSum = getDepositSum(byType);
  const withdrawalSum =
    (byType['Çekim Talebi Ödemesi']?.totalAmount ?? 0) + (byType['Çekim talebi Ödemesi']?.totalAmount ?? 0);
  const totalWithdrawn = withdrawalSum;
  const balance = account.balance ?? 0;
  const isTest = (account as any).isTest === true;
  const accountAgeDays = (account as any).accountAgeDays as number | undefined;
  const sameIPCount = Number((account as any).sameIPClientsCount ?? 0);
  const playedNames = ((account as any).playedGameNames as string[] | undefined) ?? [];

  // 1. Test hesabı
  items.push({
    id: 'not-test-account',
    label: 'Test hesabı değil',
    ok: !isTest,
    reason: isTest ? 'Hesap test hesabı olarak işaretli' : undefined,
    severity: 'high',
  });

  // 2. İşlem hacmi
  const veryHighTxCount = 500;
  items.push({
    id: 'transaction-volume-normal',
    label: `Son 3 günde işlem sayısı makul (≤${veryHighTxCount})`,
    ok: txCount <= veryHighTxCount,
    reason: txCount > veryHighTxCount ? `${txCount} işlem (yüksek)` : undefined,
    severity: 'medium',
  });

  // 3. Yatırımsız çekim
  if (withdrawalReq && withdrawalReq.count > 0 && depositSum === 0 && totalDeposits === 0) {
    if (account.isNoDepositOverride) {
      items.push({
        id: 'withdraw-without-deposit-override',
        label: 'Yatırımsız Çekim (Bonus Onaylı)',
        ok: true,
        reason: 'Hesapta yatırım yok ancak Yatırım Şartsız bir bonus (FreeSpin vb.) tespit edildi.',
        severity: 'low',
      });
    } else {
      items.push({
        id: 'withdraw-without-deposit',
        label: 'Yatırım yapılmadan çekim talebi yok',
        ok: false,
        reason: 'Çekim talebi var ancak yatırım kaydı yok',
        severity: 'high',
      });
    }
  }

  // 4. Negatif bakiye
  items.push({
    id: 'no-negative-balance',
    label: 'Negatif bakiye yok',
    ok: balance >= 0,
    reason: balance < 0 ? `Bakiye: ${balance} TRY` : undefined,
    severity: 'high',
  });

  // 5. Yeni hesap erken çekim
  if (accountAgeDays != null && withdrawalReq && withdrawalReq.count > 0) {
    const newAccountDaysThreshold = 7;
    const isNewAccountWithdrawal = accountAgeDays < newAccountDaysThreshold;
    items.push({
      id: 'account-age-withdrawal',
      label: `Yeni hesap erken çekim (hesap ≥${newAccountDaysThreshold} gün veya çekim yok)`,
      ok: !isNewAccountWithdrawal,
      reason: isNewAccountWithdrawal
        ? `Hesap ${accountAgeDays} günlük, çekim talebi mevcut`
        : undefined,
      severity: 'medium',
    });
  }

  // 6. Çekim/yatırım oranı
  let netDeposit = totalDeposits || depositSum;
  if (netDeposit > 0 && totalWithdrawn > 0) {
    const ratio = totalWithdrawn / netDeposit;
    const highRatioThreshold = 1.0;
    const ok = ratio <= highRatioThreshold;
    items.push({
      id: 'withdrawal-vs-deposit-ratio',
      label: `Çekim/yatırım oranı makul (çekilen ≤ yatırılan)`,
      ok,
      reason: !ok
        ? `Yatırım: ${netDeposit.toFixed(0)} TRY, çekilen: ${totalWithdrawn.toFixed(0)} TRY`
        : undefined,
      severity: 'medium',
    });
  }

  // 7. Opposite betting
  const oppositeDetected = (account as any).oppositeBettingDetected === true;
  items.push({
    id: 'no-opposite-betting',
    label: 'Opposite betting tespit edilmedi',
    ok: !oppositeDetected,
    reason: oppositeDetected ? 'Aynı maçta zıt bahis tespit edildi' : undefined,
    severity: 'high',
  });

  // 8. IP çakışması
  if (sameIPCount > 1) {
    items.push({
      id: 'multiple-accounts-same-ip',
      label: 'Aynı IP üzerinde birden fazla hesap',
      ok: false,
      reason: `Aynı IP'den bağlanan ${sameIPCount} farklı hesap tespit edildi (Genişletilmiş Risk)`,
      severity: 'high',
    });
  } else {
    items.push({
      id: 'single-account-ip',
      label: 'IP çakışması yok',
      ok: true,
      reason: 'Benzersiz IP adresi',
      severity: 'low',
    });
  }

  // 9. Olağandışı ROI
  if (netDeposit > 0) {
    const roi = balance / netDeposit;
    const unusualRoiThreshold = 20;
    if (roi >= unusualRoiThreshold) {
      items.push({
        id: 'unusual-roi',
        label: `Olağandışı yüksek kazanç oranı (ROI ≥ ${unusualRoiThreshold}x)`,
        ok: false,
        reason: `Yatırım: ${netDeposit.toFixed(0)} TRY, Bakiye: ${balance.toFixed(0)} TRY (${roi.toFixed(1)}x büyüme)`,
        severity: 'medium',
      });
    }
  }

  // 10. VIP
  const isVIP = netDeposit >= 50000;
  if (isVIP) {
    items.push({
      id: 'vip-high-roller',
      label: 'VIP / Yüksek Hacimli Oyuncu Profili',
      ok: true,
      reason: `Net yatırım ${netDeposit.toFixed(0)} TRY (Limit ve toleranslar esnetilebilir)`,
      severity: 'low',
    });
  }

  // 11. Kolay çevrim oyunları
  const easyTurnoverPlayed = findPlayedEasyTurnoverGames(playedNames);
  if (easyTurnoverPlayed.length > 0) {
    items.push({
      id: 'easy-turnover-games-played',
      label: 'Anapara çevrimi kolay oyunlar (soft uyarı)',
      ok: true,
      reason: `Oynanmış: ${easyTurnoverPlayed.slice(0, 5).join(', ')}`,
      severity: 'low',
    });
  }

  // 12. Kayıp hatırlatıcı (Churn Prevention)
  const lastLoginTime = account.lastLoginDateLocal ? parseDateToTime(account.lastLoginDateLocal) : 0;
  if (lastLoginTime > 0) {
    const hoursSinceLogin = (Date.now() - lastLoginTime) / (1000 * 60 * 60);
    if (hoursSinceLogin > 72) {
      items.push({
        id: 'churn-risk',
        label: 'Kayıp Oyuncu Riski (Churn)',
        ok: false,
        reason: `Oyuncu ${(hoursSinceLogin / 24).toFixed(0)} gündür giriş yapmıyor. Geri kazanma çalışması önerilir.`,
        severity: 'medium',
      });
    }
  }

  // 13. Bahis manipülasyon tespitleri
  const txs = (account.profileTransactions ?? []) as BCProfileTransaction[];
  const bets = txs.filter(tx => /bahis|bet|rake|game/i.test(String(tx.DocumentTypeName || '')))
    .sort((a, b) => parseDateToTime(a.CreatedLocal) - parseDateToTime(b.CreatedLocal));

  const isWagering = (account.wageringRemaining ?? 0) > 0;
  const roulettePlayed = playedNames.some(n => /roulette|rulet/i.test(n));

  if (isWagering && roulettePlayed) {
    items.push({
      id: 'roulette-wager-risk',
      label: 'Bonus Çevriminde Rulet Tespiti',
      ok: true,
      reason: 'Çevrim sırasında Rulet oynanmış. 25+ sayı veya low-risk kontrolü manuel yapılmalı.',
      severity: 'medium',
    });
  }

  // Bet tutarlılığı analizi
  if (bets.length > 10) {
    const last10Amounts = bets.slice(-10).map(b => Math.abs(b.Amount));
    const avgLast10 = last10Amounts.reduce((a, b) => a + b, 0) / 10;
    const historicAvg = bets.slice(0, -10).reduce((a, b) => a + Math.abs(b.Amount), 0) / (bets.length - 10) || avgLast10;

    if (avgLast10 > historicAvg * 5 && isWagering) {
      items.push({
        id: 'sudden-bet-increase',
        label: 'Anormal Bahis Artışı (Wager Pattern)',
        ok: false,
        reason: `Bahis miktarı çevrim sırasında aniden ${(avgLast10 / historicAvg).toFixed(1)} katına çıkmış.`,
        severity: 'medium',
      });
    }
  }

  // Identical bets pattern
  if (bets.length > 5) {
    const firstAmount = Math.abs(bets[0].Amount);
    const identicalBetsCount = bets.filter(b => Math.abs(b.Amount) === firstAmount).length;
    if (identicalBetsCount === bets.length && bets.length >= 10 && firstAmount > 0) {
      items.push({
        id: 'identical-bet-pattern',
        label: 'Bahis Manipülasyon Şüphesi (Sabit Tutar)',
        ok: false,
        reason: `Tüm bahisler (${bets.length} adet) istikrarlı bir şekilde aynı tutarda (${firstAmount} TRY) oynanıyo. Bot şüphesi.`,
        severity: 'medium',
      });
    }
  }

  // Baccarat risk
  const baccaratPlayed = playedNames.some(n => /baccarat/i.test(n));
  if (baccaratPlayed && isWagering) {
    items.push({
      id: 'baccarat-wager-risk',
      label: 'Bonus Çevriminde Baccarat Tespiti',
      ok: true,
      reason: 'Baccarat oyunları çevrimde riskli (Zıt bahis imkanı) kabul edilir. Manuel inceleme önerilir.',
      severity: 'low',
    });
  }

  // 14. Discount suistimal denetimi
  const lastDepTime = account.lastDeposit ? parseDateToTime(account.lastDeposit.dateLocal) : 0;
  const discountBonuses = ((account.bonuses as BCBonus[]) || []).filter(b =>
    (/discount|kayıp|iade/i.test(b.Name)) &&
    parseDateToTime(b.CreatedLocal) > lastDepTime
  );

  const weeklyDiscountCount = ((account.bonuses as BCBonus[]) || []).filter(b => /haftalık.*discount|haftalik.*discount/i.test(b.Name)).length;

  if (discountBonuses.length > 0 && balance > 0) {
    const totalDiscountAmount = discountBonuses.reduce((sum, b) => sum + (b.Amount || 0), 0);
    const hasWeekly = discountBonuses.some(b => /haftalık|haftalik/i.test(b.Name));

    items.push({
      id: 'discount-withdrawal-detect',
      label: 'Kayıp Bonusu (Discount) ile Çekim Talebi',
      ok: false,
      reason: `Son yatırımdan (${account.lastDeposit?.amount} TRY) sonra ${totalDiscountAmount} TRY discount ${hasWeekly ? '(Haftalık %5 Dahil) ' : ''}alınmış. Yatırımın kaybedildiği ve discount ile çekime gidildiği kesinleşti.`,
      severity: 'medium',
    });
  } else {
    items.push({
      id: 'discount-withdrawal-detect',
      label: 'Discount / İade Kullanımı Yok',
      ok: true,
      reason: weeklyDiscountCount > 0
        ? `Son yatırım sonrası discount yok ancak geçmişte ${weeklyDiscountCount} adet Haftalık Discount kaydı var.`
        : 'Son yatırım sonrası herhangi bir kayıp iadesi veya discount kaydı bulunamadı.',
      severity: 'low',
    });
  }

  // 15. Kayıp bonusu baz analizi
  const allWeeklyDiscounts = ((account.bonuses as BCBonus[]) || []).filter(b => /haftalık.*discount|haftalik.*discount/i.test(b.Name));
  const totalWeeklyDiscount = allWeeklyDiscounts.reduce((sum, b) => sum + (b.Amount || 0), 0);

  const allSportDiscounts = ((account.bonuses as BCBonus[]) || []).filter(b => /%20.*spor.*discount|20.*spor/i.test(b.Name));
  const totalSportDiscount = allSportDiscounts.reduce((sum, b) => sum + (b.Amount || 0), 0);

  const netLossGlobal = totalDeposits - totalWithdrawn - balance;

  let netLossBasis = netLossGlobal - totalWeeklyDiscount;
  let basisReason = `Net Kayıp: ${netLossGlobal.toFixed(0)} TRY. Alınan Haftalık Discount: ${totalWeeklyDiscount.toFixed(0)} TRY.`;

  if (account.isWeeklyDiscountBaseline) {
    basisReason = `HAFTALIK DİSCOUNT BAZI: Yatırımsız Haftalık Discount kullanımı tespit edildi. Baz olarak bu bonus kullanılıyor. (Spor Discount dikkate alınmadı).`;
    netLossBasis = netLossGlobal - totalWeeklyDiscount;
  } else {
    netLossBasis = netLossGlobal - totalWeeklyDiscount - totalSportDiscount;
    basisReason += ` Spor Discount: ${totalSportDiscount.toFixed(0)} TRY.`;
  }

  if (totalWeeklyDiscount > 0 || account.isWeeklyDiscountBaseline) {
    items.push({
      id: 'discount-basis-analysis',
      label: 'Kayıp Bonusu Hakediş Temeli (Net Kayıp)',
      ok: netLossBasis > 0,
      reason: `${basisReason} Bonus için kalan baz: ${netLossBasis.toFixed(0)} TRY.`,
      severity: 'low',
    });
  }

  // 16. Özel bonus kontrolleri (çevrimsiz, hoşgeldin, haftalık discount)
  items.push(...evaluateSpecialBonusChecks(account, balance, playedNames, lastDepTime));

  return { overallOk: items.every((i) => i.ok || i.id === 'discount-withdrawal-detect'), items };
}

// ─── Özel Bonus Kontrolleri (Ayrı Fonksiyon) ─────────────────────────────────

function evaluateSpecialBonusChecks(
  account: AccountSnapshot,
  balance: number,
  playedNames: string[],
  lastDepTime: number
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const bonusList = (account.bonuses as BCBonus[]) || [];

  // %25 Çevrimsiz Casino
  const activeCevrimsiz = bonusList.find(b =>
    /çevrimsiz.*yatırım|cevrimsiz.*yatirim|%25.*çevrimsiz|25.*cevrimsiz/i.test(b.Name) &&
    parseDateToTime(b.CreatedLocal) >= lastDepTime
  );

  if (activeCevrimsiz) {
    const depAmount = account.lastDeposit?.amount || 0;
    if (depAmount < 1000) {
      items.push({
        id: 'cevrimsiz-min-dep',
        label: '%25 Çevrimsiz Bonus - Minimum Yatırım Şartı',
        ok: false,
        reason: `HATA: Çevrimsiz Yatırım Bonusu için gereken min. yatırım 1000 TL'dir (Son Yatırım: ${depAmount} TL).`,
        severity: 'high',
      });
    } else {
      items.push({
        id: 'cevrimsiz-min-dep',
        label: '%25 Çevrimsiz Bonus - Min Yatırım (1000 TL)',
        ok: true,
        reason: `Uygun. (Yatırım: ${depAmount} TL).`,
        severity: 'low',
      });
    }

    if (playedNames.some(n => /roulette|rulet/i.test(n))) {
      items.push({
        id: 'cevrimsiz-roulette-risk',
        label: '%25 Çevrimsiz - Rulet Çevrim / Kazanç İhlal Riski',
        ok: false,
        reason: 'DİKKAT: Rulet bahsi tespit edildi. 1\'e 2 ve 1\'e 3 oranlı bahislerin çevrime DAHİL OLMAMASI veya Max 19 sayı kuralına uyulması gerekiyor (Manuel kontrol gerektirir!).',
        severity: 'high',
      });
    }

    if (playedNames.some(n => /sport|spor/i.test(n))) {
      items.push({
        id: 'cevrimsiz-sport-odds',
        label: '%25 Çevrimsiz Spor - Oran Kuralı',
        ok: false,
        reason: 'DİKKAT: Spor bahsi mevcut. Her bahsin min. 1.50 oran olup olmadığı kontrol edilmelidir.',
        severity: 'high',
      });
    }

    items.push({
      id: 'cevrimsiz-deduct-warn',
      label: `%25 Çevrimsiz - Ödeme Kuralı (${activeCevrimsiz.Amount} TRY Bonus Düşülecektir)`,
      ok: true,
      reason: `ÖNEMLİ: Çekim onaylanırken alınan ${activeCevrimsiz.Amount} TRY Çevrimsiz Bonus tutarının bakiyeden/ödemeden düşülmesi gereklidir.`,
      severity: 'medium',
    });
  }

  // %100 Casino Hoşgeldin
  const activeWelcome100 = bonusList.find(b =>
    /100.*(hosgeldin|hoşgeldin).*casino/i.test(b.Name) &&
    parseDateToTime(b.CreatedLocal) >= lastDepTime
  );

  if (activeWelcome100) {
    const depAmount = account.lastDeposit?.amount || 0;
    if (depAmount < 2500) {
      items.push({
        id: 'welcome100-min-dep',
        label: '%100 Casino Hoşgeldin - Minimum Yatırım Şartı',
        ok: false,
        reason: `HATA: Hoşgeldin Bonusu için min. yatırım 2500 TL olmalıdır (Son Yatırım: ${depAmount} TL).`,
        severity: 'high',
      });
    }

    const maxWin = (activeWelcome100.Amount || 0) * 30;
    const isExceeding = maxWin > 0 && balance > maxWin;
    items.push({
      id: 'welcome100-max-warn',
      label: '%100 Casino Hoşgeldin - Max Kazanç & Kurallar',
      ok: !isExceeding,
      reason: isExceeding
        ? `HATA: Çekilebilir bakiye sınırını aşıyor (Limit: ${maxWin} TL). Alınan ${activeWelcome100.Amount} TL bonusu da düşerek fazla bakiyeyi silip çekimi verin.`
        : `Uygun. Dikkat: ${activeWelcome100.Amount} TL bonus tutarı çekimde bakiyeden DÜŞÜLMELİDİR. (Max kazanç sınırı: ${maxWin} TL)`,
      severity: isExceeding ? 'high' : 'medium',
    });

    if (playedNames.some(n => /roulette|rulet/i.test(n))) {
      items.push({
        id: 'welcome100-roulette-risk',
        label: '%100 Casino Hoşgeldin - Canlı Casino Kural Riski',
        ok: false,
        reason: 'DİKKAT: Rulet (1\'e 2 oran/Max 19 sayı) kural ihlali için işlem geçmişi manuel incelenmeli!',
        severity: 'high',
      });
    }

    if (playedNames.some(n => /sport|spor/i.test(n))) {
      items.push({
        id: 'welcome100-sport-alert',
        label: '%100 Casino Hoşgeldin - Alan İhlali',
        ok: false,
        reason: 'HATA: Spor alanında bahis yapıldığı tespit edildi. Bu bonus sadece Casino kısmında geçerlidir.',
        severity: 'high',
      });
    }
  }

  // Haftalık %5 Discount
  const activeWeeklyDiscount = bonusList.find(b =>
    (/5.*discount|%5.*discount|haftalık.*discount|haftalik.*discount/i.test(b.Name)) &&
    parseDateToTime(b.CreatedLocal) >= lastDepTime
  );

  if (activeWeeklyDiscount) {
    const txs = (account.profileTransactions ?? []) as BCProfileTransaction[];
    const depositTxs = txs.filter(tx => tx.DocumentState === 2 && /deposit|yatırım/i.test(tx.DocumentTypeName));
    const eligibleDeposits = depositTxs.filter(tx => (Number(tx.Amount) || 0) >= 1000);

    items.push({
      id: 'weekly-discount-min-dep',
      label: 'Haftalık %5 Discount - Her Gün 1000 TL Şartı',
      ok: false,
      reason: `DİKKAT: Kural gereği HAFTANIN HER GÜNÜ tek seferde en az 1000 TL yatırım yapılmalı. Oyuncunun işlem geçmişinde ${eligibleDeposits.length} adet 1000+ TL yatırım bulundu. Tam 7 gün kuralı için MANUEL KONTROL zorunludur.`,
      severity: 'high',
    });

    items.push({
      id: 'weekly-discount-deduct',
      label: `Haftalık %5 Discount - Ödeme Kuralı (${activeWeeklyDiscount.Amount} TRY Bonus Düşülecek)`,
      ok: true,
      reason: `BİLGİ: Çekim onaylanırken alınan ${activeWeeklyDiscount.Amount} TRY tutarındaki Haftalık Discount bonusunun bakiyeden düşülerek geriye kalan tutarın ödenmesi gereklidir.`,
      severity: 'medium',
    });

    const maxWin = (activeWeeklyDiscount.Amount || 0) * 30;
    const isExceeding = maxWin > 0 && balance > maxWin;
    items.push({
      id: 'weekly-discount-max-win',
      label: 'Haftalık %5 Discount - Max Kazanç (30 Katı)',
      ok: !isExceeding,
      reason: isExceeding
        ? `HATA: Çekilebilir bakiye sınırını aşıyor (Limit: ${maxWin} TL). Alınan bonus tutarını da düşerek sadece ${maxWin} TL'ye kadar ödeme yapın.`
        : `Uygun. Dikkat: Bonus tutarı çekimde bakiyeden DÜŞÜLMELİDİR. (Maksimum çekilebilir kazanç: ${maxWin} TL)`,
      severity: isExceeding ? 'high' : 'medium',
    });

    if (playedNames.some(n => /sport|spor/i.test(n))) {
      items.push({
        id: 'weekly-discount-sport-odds',
        label: 'Haftalık %5 Discount - Spor Oran Kuralı',
        ok: false,
        reason: 'DİKKAT: Spor bahsi tespit edildi. Her karşılaşma için en az 1.50 orandan 1 katı çevrim şartı sağlanıp sağlanmadığını manuel kontrol ediniz.',
        severity: 'high',
      });
    }
  }

  return items;
}
