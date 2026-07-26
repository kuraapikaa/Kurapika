import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

interface MarketItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    rewardType: 'bonus' | 'freespin' | 'cash';
    rewardValue: number;
    platformBonusId?: number;
    image?: string;
}

interface PlayerLoyalty {
    xp: number;
    level: number;
    points: number;
    balance: number; // Real platform balance
    totalWagerSynced: number; // Last synced total turnover
    inventory: string[];
    lastUpdate: string;
}

const LEGACY_LOYALTY_JSON_PATH = join(process.cwd(), 'src', 'data', 'player-loyalty.json');
const LOYALTY_DIR = join(process.cwd(), 'src', 'data', 'player-loyalty');

const DEFAULT_MARKET: MarketItem[] = [
    { id: 'freebet_25', name: '25 TL Freebet', description: 'Minimum 1.30 oranlı spor kuponlarında kullanılabilir.', cost: 250, rewardType: 'bonus', rewardValue: 25, platformBonusId: 1875 },
    { id: 'bonus_50', name: '50 TL Bonus', description: 'Narcosbahis slot bonusu.', cost: 500, rewardType: 'bonus', rewardValue: 50, platformBonusId: 1876 },
    { id: 'bonus_100', name: '100 TL Bonus', description: 'Narcosbahis slot bonusu.', cost: 900, rewardType: 'bonus', rewardValue: 100, platformBonusId: 1877 },
];

export class LoyaltyService {
    private readonly tenantKey: string;
    private readonly dataPath: string;
    private loadPromise: Promise<void> | null = null;
    private data: { players: Record<string, PlayerLoyalty>; market: MarketItem[]; wagerToPointRatio: number } = {
        players: {},
        market: DEFAULT_MARKET,
        wagerToPointRatio: 100 // 100 TL wager = 1 point
    };

    constructor(tenantKey = 'default') {
        this.tenantKey = safeTenantKey(tenantKey);
        this.dataPath = join(LOYALTY_DIR, `${this.tenantKey}.json`);
    }

    private async ensureLoaded(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            const legacyPath = this.tenantKey === 'default' ? LEGACY_LOYALTY_JSON_PATH : undefined;
            this.data = await readStoredDocument({
                tenantKey: this.tenantKey,
                namespace: 'player-loyalty',
                filePath: this.dataPath,
                fallback: async () => {
                    if (legacyPath) {
                        try {
                            const { readFile } = await import('fs/promises');
                            return JSON.parse(await readFile(legacyPath, 'utf8'));
                        } catch {
                            // use defaults
                        }
                    }
                    return { players: {}, market: DEFAULT_MARKET, wagerToPointRatio: 100 };
                },
            });
            if (!this.data.players) this.data.players = {};
            if (!Array.isArray(this.data.market) || this.data.market.length === 0) this.data.market = DEFAULT_MARKET;
            if (!this.data.wagerToPointRatio) this.data.wagerToPointRatio = 100;
        })();
        return this.loadPromise;
    }

    private async save(): Promise<void> {
        await writeStoredDocument(
            { tenantKey: this.tenantKey, namespace: 'player-loyalty', filePath: this.dataPath },
            this.data,
        );
    }

    public async getPlayerStatus(username: string): Promise<PlayerLoyalty> {
        await this.ensureLoaded();
        if (!this.data.players[username]) {
            this.data.players[username] = {
                xp: 0,
                level: 1,
                points: 0,
                balance: 0,
                totalWagerSynced: 0,
                inventory: [],
                lastUpdate: new Date().toISOString()
            };
            await this.save();
        }
        return this.data.players[username];
    }

    public calculateLevel(xp: number): number {
        return Math.floor(xp / 1000) + 1;
    }

    private async getClientInfo(username: string, authToken: string): Promise<{ id: number, balance: number } | null> {
        try {
            const res = await fetch(config.clientsApi.baseUrl + '/' + config.clientsApi.path, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json; text/plain; */*',
                    'Origin': 'https://backofficewebadmin.betconstruct.com',
                    'Referer': 'https://backofficewebadmin.betconstruct.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json;charset=UTF-8',
                    'authentication': authToken.trim()
                },
                body: JSON.stringify({
                    Login: username,
                    MaxRows: 1,
                    SkeepRows: 0,
                    Id: 0,
                    FirstName: '',
                    LastName: '',
                    IsOrderedDesc: true,
                    OrderedItem: 1
                })
            });
            const data: any = await res.json();
            const obj = data?.Data?.Objects?.[0];
            return obj ? { id: obj.Id, balance: Number(obj.Balance) || 0 } : null;
        } catch (e) {
            console.error('GetClientInfo error:', e);
            return null;
        }
    }

    /** BetConstruct üzerinden toplam turnover'ı çekip puanları senkronize eder. */
    public async syncPointsFromWager(username: string, authToken: string) {
        const player = await this.getPlayerStatus(username);
        const info = await this.getClientInfo(username, authToken);
        
        if (!info) {
            console.warn(`[loyalty] ClientInfo bulunamadı: ${username}`);
            return player;
        }

        // Balance güncelle
        console.log(`[loyalty] Syncing ${username} - BC Balance: ${info.balance}`);
        player.balance = info.balance;

        try {
            const res = await fetch(`${config.clientKpiApi.baseUrl}/${config.clientKpiApi.path}?id=${info.id}`, {
                method: 'GET',
                headers: { 'authentication': authToken.trim() }
            });
            const data: any = await res.json();
            const kpi = data?.Data;
            
            if (!kpi) {
                console.warn(`[loyalty] KPI verisi alınamadı: ${username}`);
                await this.save();
                return player;
            }

            const totalCasinoWager = Number(kpi.TotalCasinoBet) || 0;
            const totalSportWager = Number(kpi.TotalSportBet) || 0;
            const currentTotalWager = totalCasinoWager + totalSportWager;

            console.log(`[loyalty] ${username} Turnover: ${currentTotalWager} (Prev: ${player.totalWagerSynced})`);

            // Eğer yeni bahis varsa puan ekle
            if (currentTotalWager > player.totalWagerSynced) {
                const diff = currentTotalWager - player.totalWagerSynced;
                const earnedPoints = Math.floor(diff / this.data.wagerToPointRatio);
                
                if (earnedPoints > 0) {
                    player.points += earnedPoints;
                    player.xp += earnedPoints * 10;
                    player.level = this.calculateLevel(player.xp);
                    console.log(`[loyalty] ${username} kazandığı puan: ${earnedPoints}`);
                }
                
                player.totalWagerSynced = currentTotalWager;
            }
            
            player.lastUpdate = new Date().toISOString();
            await this.save();
        } catch (e) {
            console.error('SyncPoints error:', e);
            await this.save();
        }

        return player;
    }

    public async buyItem(username: string, itemId: string) {
        const player = await this.getPlayerStatus(username);
        const item = this.data.market.find(i => i.id === itemId);

        if (!item) throw new Error('Ürün bulunamadı');
        if (player.points < item.cost) throw new Error('Yetersiz puan');

        player.points -= item.cost;
        player.inventory.push(item.id);
        await this.save();
        
        return { player, item };
    }

    public async getMarket() {
        await this.ensureLoaded();
        return this.data.market;
    }

    public async getWagerToPointRatio() {
        await this.ensureLoaded();
        return this.data.wagerToPointRatio;
    }

    public async updateConfig(market: MarketItem[], wagerToPointRatio: number) {
        await this.ensureLoaded();
        this.data.market = market;
        this.data.wagerToPointRatio = wagerToPointRatio;
        await this.save();
    }

    public async addXp(username: string, amount: number) {
        const player = await this.getPlayerStatus(username);
        player.xp += amount;
        player.level = this.calculateLevel(player.xp);
        player.lastUpdate = new Date().toISOString();
        await this.save();
        return player;
    }
}

export const loyaltyService = new LoyaltyService();

const tenantServices = new Map<string, LoyaltyService>();

export function getLoyaltyService(tenantKey = 'default') {
    const key = safeTenantKey(tenantKey);
    if (!tenantServices.has(key)) {
        tenantServices.set(key, new LoyaltyService(key));
    }
    return tenantServices.get(key)!;
}
