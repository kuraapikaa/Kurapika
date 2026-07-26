import type { AccountSnapshot } from './withdrawalEngine.js';
import { evaluateRiskAnalysis } from './withdrawalEngine.js';

export interface PlayerScorecard {
    clientId: number;
    login: string;
    trustScore: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    topFlags: string[];
    metrics: {
        depositWithdrawalRatio: number;
        bonusUsageRate: number; // percentage of deposits that had bonuses
        winRate: number;
        ipCount: number;
        loyaltyScore: number;
    };
    category: 'VIP' | 'Regular' | 'Bonus Hunter' | 'Potential Fraud' | 'At Risk';
}

export interface MultiAccountCluster {
    id: string; // generated ID for the cluster
    type: 'IP' | 'Behavioral' | 'Name';
    clients: {
        id: number;
        login: string;
        registrationDate: string;
    }[];
    reason: string;
    riskScore: number;
}

export interface BusinessInsight {
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info' | 'critical';
    metric?: string;
    impact: number; // 0-100
    recommendation: string;
}

export interface BonusRecommendation {
    bonusName: string;
    targetGroup: string;
    estimatedCvr: number; // conversion rate increase
    suggestedAmount: string;
    reasoning: string;
}

/**
 * Calculates a comprehensive trust score for a player based on their snapshot.
 */
export function calculateTrustScore(snapshot: any): PlayerScorecard {
    const riskAnalysis = evaluateRiskAnalysis(snapshot as any);
    const flags = riskAnalysis.items.filter(i => !i.ok);

    // Base score starts at 100
    let score = 100;

    // Penalize based on severity of risk items
    flags.forEach(flag => {
        if (flag.severity === 'high') score -= 25;
        if (flag.severity === 'medium') score -= 10;
        if (flag.severity === 'low') score -= 5;
    });

    // Bonuses vs Deposits check
    const totalDeposits = snapshot.totalDeposits || 0;
    const totalBonuses = (snapshot.bonuses as any[] || []).reduce((sum, b) => sum + (b.Amount || 0), 0);
    const bonusRate = totalDeposits > 0 ? (totalBonuses / totalDeposits) : 0;
    if (bonusRate > 0.8) score -= 15; // Heavy bonus seeker

    // ROI check
    const balance = snapshot.balance || 0;
    const roi = totalDeposits > 0 ? (balance / totalDeposits) : 0;
    if (roi > 20) score -= 10; // Unusual growth

    // Final Clamping
    score = Math.max(0, Math.min(100, score));

    let riskLevel: PlayerScorecard['riskLevel'] = 'low';
    if (score < 40) riskLevel = 'critical';
    else if (score < 65) riskLevel = 'high';
    else if (score < 85) riskLevel = 'medium';

    // Categorization
    let category: PlayerScorecard['category'] = 'Regular';
    if (totalDeposits > 50000) category = 'VIP';
    if (bonusRate > 0.7 && score < 70) category = 'Bonus Hunter';
    if (score < 40) category = 'Potential Fraud';

    const lastLoginTime = snapshot.lastLoginDateLocal ? new Date(snapshot.lastLoginDateLocal).getTime() : 0;
    const daysSinceLogin = lastLoginTime > 0 ? (Date.now() - lastLoginTime) / (1000 * 60 * 60 * 24) : 0;
    if (daysSinceLogin > 7 && category !== 'Potential Fraud') category = 'At Risk';

    return {
        clientId: Number(snapshot.id || snapshot.ClientId),
        login: String(snapshot.login || snapshot.UserName || 'Unknown'),
        trustScore: score,
        riskLevel,
        topFlags: flags.map(f => f.label),
        metrics: {
            depositWithdrawalRatio: snapshot.totalWithdrawn && totalDeposits ? snapshot.totalWithdrawn / totalDeposits : 0,
            bonusUsageRate: bonusRate,
            winRate: snapshot.totalBets && snapshot.totalWins ? snapshot.totalWins / snapshot.totalBets : 0,
            ipCount: snapshot.sameIPClientsCount || 1,
            loyaltyScore: Math.min(100, (snapshot.accountAgeDays || 0) / 3.65) // 100 points for 1 year
        },
        category
    };
}

/**
 * Identifies potential multi-accounting clusters from a list of clients.
 * In a real scenario, this would query a database for IP/Device history.
 * Here we simulate/demonstrate logic using common fields.
 */
export async function identifyMultiAccountClusters(clients: any[]): Promise<MultiAccountCluster[]> {
    const clusters: MultiAccountCluster[] = [];
    const ipMap = new Map<string, any[]>();

    // 1. IP Based Detection
    clients.forEach(c => {
        if (c.LoginIP || c.RegistrationIP) {
            const ip = c.LoginIP || c.RegistrationIP;
            const existing = ipMap.get(ip) || [];
            existing.push(c);
            ipMap.set(ip, existing);
        }
    });

    for (const [ip, members] of ipMap.entries()) {
        if (members.length > 1) {
            clusters.push({
                id: `cluster-ip-${ip}`,
                type: 'IP',
                clients: members.map(m => ({
                    id: m.Id || m.ClientId,
                    login: m.UserName || m.Login,
                    registrationDate: m.RegistrationDate || ''
                })),
                reason: `Shared IP Address: ${ip}`,
                riskScore: Math.min(100, members.length * 20)
            });
        }
    }

    // 2. Behavioral / Name Cluster (Simulated logic - e.g. same last name if available)
    // In actual implementation, we'd check for similar email patterns or name overlaps.


    return clusters.sort((a, b) => b.riskScore - a.riskScore);
}

export function generateBusinessInsights(summary: any, partnerProfit: any): { insights: BusinessInsight[], bonuses: BonusRecommendation[] } {
    const insights: BusinessInsight[] = [];
    const bonuses: BonusRecommendation[] = [];

    const stats = summary?.Data || summary;
    const profitData = partnerProfit?.Data?.Data || [];

    // 1. Analyze GGR and Margins
    const totalDeposits = stats?.TotalDepositAmount || 0;
    const totalWithdrawals = stats?.TotalWithdrawAmount || 0;
    const ggr = totalDeposits - totalWithdrawals;

    if (ggr > 0 && totalDeposits > 0) {
        const margin = (ggr / totalDeposits) * 100;
        if (margin < 15) {
            insights.push({
                title: 'Düşük Kâr Marjı Uyarısı',
                description: `Kâr marjınız %${margin.toFixed(1)} seviyesinde. Sektör ortalaması %20-25 civarındadır.`,
                type: 'warning',
                metric: `%${margin.toFixed(1)} Margin`,
                impact: 85,
                recommendation: 'Bonus çevrim şartlarını gözden geçirin ve spor bahislerindeki riskli oran limitlerini daraltın.'
            });
        } else {
            insights.push({
                title: 'Güçlü Finansal Performans',
                description: `Kâr marjınız %${margin.toFixed(1)} ile sağlıklı bir seviyede seyrediyor.`,
                type: 'success',
                metric: 'Stabil GGR',
                impact: 90,
                recommendation: 'Mevcut stratejiyi koruyun ve yüksek değerli (high-roller) oyunculara yönelik özel turnuvalar düzenleyin.'
            });
        }
    }

    // 2. Bonus Recommendations
    const bonusAmount = stats?.TotalBonusAmount || 0;
    const bonusRatio = totalDeposits > 0 ? (bonusAmount / totalDeposits) * 100 : 0;

    if (bonusRatio > 40) {
        insights.push({
            title: 'Aşırı Bonus Yükü',
            description: `Yatırımların %${bonusRatio.toFixed(1)}'i bonus olarak geri dönüyor. Bu sürdürülebilir değil.`,
            type: 'critical',
            impact: 95,
            recommendation: 'Genel yatırım bonuslarını %10-15 aralığına çekin. Kayıp bonusu (Discount) ağırlıklı bir modele geçin.'
        });

        bonuses.push({
            bonusName: '%10 Sabit Yatırım Bonusu',
            targetGroup: 'Tüm Oyuncular',
            estimatedCvr: 5,
            suggestedAmount: '%10',
            reasoning: 'Mevcut yüksek oranlı bonusların maliyetini düşürürken oyuncu trafiğini korur.'
        });
    } else {
        bonuses.push({
            bonusName: 'VIP Hafta Sonu Boost',
            targetGroup: 'VIP Kademe',
            estimatedCvr: 12,
            suggestedAmount: '500 TL Freebet',
            reasoning: 'Hafta sonu aktifliğini artırmak ve VIP sadakatini pekiştirmek için ideal.'
        });
    }

    // 3. Game/Vertical Analysis
    const casinoProfit = profitData.find((p: any) => p.GameType === 'Casino')?.Profit || 0;
    const sportProfit = profitData.find((p: any) => p.GameType === 'Sportbook')?.Profit || 0;

    if (casinoProfit > sportProfit * 2) {
        insights.push({
            title: 'Casino Odaklı Büyüme',
            description: 'Gelirlerinizin büyük çoğunluğu Casino dikeyinden geliyor.',
            type: 'info',
            impact: 60,
            recommendation: 'Spor bahislerini canlandırmak için popüler liglere (Premier League, Şampiyonlar Ligi) özel kombine bonusları tanımlayın.'
        });

        bonuses.push({
            bonusName: 'Kombine Sigortası',
            targetGroup: 'Spor Bahisçileri',
            estimatedCvr: 8,
            suggestedAmount: 'İade Garantili',
            reasoning: 'Spor bahislerindeki risk algısını azaltır ve kupon sayısını artırır.'
        });
    }

    // 4. Player Retention & Growth (Based on summary stats)
    const newPlayers = stats?.NewPlayersCount || 0;
    const totalPlayers = stats?.TotalPlayersCount || 0;

    if (newPlayers > 0 && totalPlayers > 0) {
        const acquisitionRate = (newPlayers / totalPlayers) * 100;
        if (acquisitionRate > 20) {
            insights.push({
                title: 'Hızlı Oyuncu Kazanımı',
                description: `Yeni kayıt oranınız %${acquisitionRate.toFixed(1)} ile çok yüksek.`,
                type: 'success',
                impact: 75,
                recommendation: 'Yeni gelen bu kitlenin "ilk yatırım" dönüşümünü artırmak için Hoş Geldin Bonusunu vurgulayın.'
            });
        }
    }

    // 5. Fallback - Ensure insights is never empty
    if (insights.length === 0) {
        insights.push({
            title: 'Operasyonel Stabilite',
            description: 'Mevcut veriler ışığında operasyonunuz stabil ve dengeli bir seyir izliyor.',
            type: 'info',
            impact: 40,
            recommendation: 'Büyük ölçekli değişikliklere şu an gerek yok. Mevcut pazarlama bütçesini aynı oranda koruyun.'
        });
    }

    // 6. Extra Bonus Variety
    if (bonuses.length < 2) {
        bonuses.push({
            bonusName: 'Gece Kuşu Ödülü',
            targetGroup: 'Gece Aktifleri',
            estimatedCvr: 6,
            suggestedAmount: '%20 İade',
            reasoning: 'Gece saatlerindeki oyuncu trafiğini ve oyun hacmini stabilize eder.'
        });
    }

    return { insights, bonuses };
}
