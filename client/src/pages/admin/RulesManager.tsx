import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Settings, AlertCircle, CheckCircle2, Plus,
    Trash2, Edit2, Search, FileCode,
    Info, RefreshCw, Sparkles, ArrowRight, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardApi } from '@/api/client';
import { BonusBlacklistPanel } from '@/components/admin/BonusBlacklistPanel';

interface PromoSpec {
    enabled?: boolean;
    // Basic Info
    /**
     * Kuralin gorunen adi. Sunucu tarafinda hep vardi ama istemci tipinde
     * modellenmemisti; bu yuzden Kural Merkezi'nde hic duzenlenemiyordu.
     * Nakit bonuslarin Lynon'da kampanyasi olmadigi icin baska ad kaynagi
     * da yok — kartlarda yalnizca ham anahtar goruluyordu.
     */
    title?: string;
    type?: 'partner' | 'cash' | 'wheel';
    partnerBonusId?: string;
    /**
     * Tek kural, birden fazla bonus ID — hangisinin verilecegini yatirim
     * tutari belirler. Bos ise `partnerBonusId` ile eski davranis surer.
     * Kurallar sunucuda: `server/src/services/bonusAraliklari.ts`.
     */
    partnerBonusRanges?: Array<{ min: number | string; max?: number | string | null; partnerBonusId: string }>;

    // Amount Settings
    amountType?: 'fixed' | 'percentage' | 'full' | 'tiered' | 'tieredRange' | 'tieredPercentage'
        | 'dailySequencePercentage' | 'averageOfLastDeposits';
    /** Gunun 1., 2., ... yatirimina uygulanacak yuzdeler (Carsamba Happy Days). */
    dailySequencePercents?: number[];
    /** Ayni gun kaybedilmis ardisik yatirim sarti (4. Yatirim Hediyesi). */
    consecutiveLossDeposits?: number;
    /** Ortalamaya girecek yatirim sayisi. */
    averageDepositCount?: number;
    minimumBonus?: number;
    maximumBonus?: number;
    fixedAmount?: number;
    percentageAmount?: number;
    tieredAmounts?: { min: number; bonus: number }[];
    tieredRanges?: { min: number; max: number; bonus: number }[];
    tieredPercentageRanges?: { min: number; max: number; percent: number; maxBonus?: number }[];
    /** Bonus tabanini yatirimdan NET KAYBA cevirir (promoEvaluator.depositBasis). */
    lossBonus?: boolean;
    /** lossBonus tabaninin donemi: omur boyu (son cekimden itibaren) ya da takvim haftasi. */
    lossBonusPeriod?: 'sinceLastWithdrawal' | 'weekly' | 'last24h';

    // Automation & Loss Bonus
    isAutoCharge?: boolean;
    isNextDayBonus?: boolean;
    autoGrantNextDayAt0015?: boolean;
    assignmentValues?: Record<string, unknown>;
    freespinBetLevel?: number;
    freespinCount?: number;
    freespinGame?: unknown;
    freespinGameId?: number;
    freespinGameProviderId?: number;
    excludeFromLossCalculations?: boolean;

    // Limits & Rules
    checkPendingWithdrawal?: boolean;
    checkLastTransactionIsDeposit?: boolean;
    checkSingleInvestmentUsage?: boolean;
    checkSameDayUsage?: boolean;
    requiresPhoneVerified?: boolean;
    requiresTelegramMember?: boolean;
    requiresEmailVerified?: boolean;
    checkIPDuplicate?: boolean;
    allowedProviders?: string[];

    maxKpiLimit?: number;
    newPlayerMaxDeposits?: number;
    maxBalanceToClaim?: number;
    minBalanceToClaim?: number;

    // Constraints
    /** Talep aninda bakiye bu tutarin altinda olmali. */
    balanceBelow?: number;
    /** Talep aninda acik bahis/casino turu olmamali. */
    noOpenBets?: boolean;
    activeDays?: string[];
    startTime?: string;
    endTime?: string;

    // Advanced & Limits
    minDep?: number;
    minDepositAmount?: number;
    maxDepositAmount?: number;
    perDayLimit?: number;
    perWeekLimit?: number;
    isFirstDepositBonus?: boolean;
    onlyNewUsersNoDepositNoWithdraw?: boolean;
    principalWagerMult?: number;
    bonusWagerMult?: number;
    casinoWagering?: number;
    sportWagering?: number;
    minSportOdds?: number;
    maxPayoutMult?: number;
    maxPayoutFixed?: number;
}

interface RulesConfig {
    PROMO_SPECS: Record<string, PromoSpec>;
    PROMO_TITLE_SPECS: Record<string, PromoSpec>;
    /**
     * Listeden gizlenen Lynon kampanyalari. Katalog satirlari kural kaydi
     * olmasa da gosterildigi icin, silinen bir kampanya buraya yazilmazsa
     * yer tutucu olarak hemen geri gelir.
     */
    HIDDEN_PROMO_IDS?: string[];
}

type RulePreset = {
    key: string;
    targetMap: 'PROMO_SPECS' | 'PROMO_TITLE_SPECS';
    label: string;
    description: string;
    /** Var olan kuralın ÜZERİNE merge edilecek alanlar (yalnızca bunlar değişir); yeni kuralda TÜM spec budur. */
    patch: PromoSpec;
};

/**
 * Hazır bonus şablonları.
 *
 * İlk ikisi CANLIDA zaten var olan kurallardaki gerçek, doğrulanmış
 * yapılandırma hatalarını düzeltir (bkz. handleApplyPreset — var olan
 * kuralın üstüne MERGE edilir, diğer alanlar korunur, ezilmez):
 *
 *   - 1845 "%100 Risksiz İlk Yatırım": tieredPercentageRanges 1.000-10.000₺
 *     arası %100 diyordu ama maxDepositAmount 2.000₺'de kalmıştı — 2.000₺
 *     üzeri net kayıp sessizce reddediliyordu.
 *   - 1872 "İlk Yatırımına 2X İle Başla": kademeler min===max (tam eşleşme)
 *     olarak girilmişti — yalnızca tam 500/750/1000/2000/5000₺ yatıran
 *     kazanıyordu, aradaki (çoğu gerçek) tutar hiçbir kademeye girmiyordu.
 *
 * Üçüncüsü YENİ bir kural: default.json'da tam speci hazır duruyordu ama
 * canlı Kural Merkezi'ne hiç eklenmemişti.
 *
 * Dördüncü ve beşincisi 11.08.2026'da canlıda bulunan gerçek bir çift kural
 * çakışması: "1874 Narcos Kayıp Bonusu" (kademeli %20/25/30) ve "2046" (aynı
 * Lynon kampanyasına — partnerBonusId 2046 — bağlı, sabit 20/25/30₺
 * versiyonu) ikisi de isAutoCharge:true. 1874'te maxDepositAmount 1₺'de
 * kaldığı için hiçbir gerçek kayıp bu eşiği geçemiyor, kural hiç
 * ateşlenmiyordu; onun yerine yalnızca 2046 (sabit, çok daha küçük) tutar
 * veriyordu. 1874 düzeltilince ikisi birden ateşlenip aynı kayba çifte
 * ödeme yapmaması için 2046 kapatılıyor.
 */
const RULE_PRESETS: RulePreset[] = [
    {
        key: '1845',
        targetMap: 'PROMO_SPECS',
        label: '%100 Risksiz İlk Yatırım — tavan düzeltmesi',
        description: 'maxDepositAmount 2.000₺\'den 10.000₺\'ye çıkar. Kademeli tablo zaten 1.000-10.000₺ arasını %100 diye tanımlıyor; 2.000₺ tavanı bunu sessizce eziyordu, yalnızca bu alan değişir.',
        patch: { maxDepositAmount: 10000 },
    },
    {
        key: '1872',
        targetMap: 'PROMO_SPECS',
        label: 'İlk Yatırımına 2X İle Başla — kademe düzeltmesi',
        description: 'Kademeleri tam-eşleşme yerine gerçek aralığa çevirir (500-749, 750-999, 1000-1999, 2000-4999₺ hepsi %100; 5000₺ ve üzeri öncekiyle aynı şekilde %0 kalır).',
        patch: {
            tieredPercentageRanges: [
                { min: 500, max: 749, percent: 100 },
                { min: 750, max: 999, percent: 100 },
                { min: 1000, max: 1999, percent: 100 },
                { min: 2000, max: 4999, percent: 100 },
                { min: 5000, max: 999999999, percent: 0 },
            ],
        },
    },
    {
        key: 'carsamba-happy-days',
        targetMap: 'PROMO_SPECS',
        label: '%400 Çarşamba Happy Days — yeni kural',
        description: 'Şu an Kural Merkezi\'nde hiç yok. Yalnızca Çarşamba günü, günün 1-5. yatırımına sırasıyla %20/40/60/80/100, minimum yatırım 250₺.',
        patch: {
            enabled: true, type: 'cash', title: '%400 Çarşamba Happy Days',
            activeDays: ['wednesday'], amountType: 'dailySequencePercentage',
            dailySequencePercents: [20, 40, 60, 80, 100],
            minDepositAmount: 250, balanceBelow: 10, noOpenBets: true,
            casinoWagering: 15, maxPayoutMult: 10, excludeFromLossCalculations: true,
        },
    },
    {
        key: '1874',
        targetMap: 'PROMO_SPECS',
        label: 'Narcos Kayıp Bonusu — tavan düzeltmesi',
        description: 'maxDepositAmount 1₺\'de kalmıştı; hiçbir gerçek kayıp bu eşiği geçemediği için %20/25/30 kademeli kural hiç ateşlenmiyordu. Alan tamamen kaldırılır — kademeler (50-4.999₺ →%20, 5.000-19.999₺ →%25, 20.000-200.000₺ →%30) tek başına eşiği belirler.',
        patch: { maxDepositAmount: undefined },
    },
    {
        key: '2046',
        targetMap: 'PROMO_SPECS',
        label: 'Kural 2046 — devre dışı bırak',
        description: '1874 ile aynı Lynon kampanyasına (partnerBonusId 2046) bağlı, eski sabit-tutar (20/25/30₺) versiyon. 1874 düzeltilince ikisi birden ateşlenip aynı kayba çifte bonus verirdi; bu yüzden kapatılır.',
        patch: { enabled: false },
    },
];

export function RulesManager() {
    const queryClient = useQueryClient();
    const activeTab = 'id';
    const [searchTerm, setSearchTerm] = useState('');
    /** Gizlenen Lynon kampanyalarini da listele (geri almak icin). */
    const [gizlenenleriGoster, setGizlenenleriGoster] = useState(false);
    /**
     * ALAN KALABALIGI.
     *
     * Duzenleme paneli 30'u askin alan tasiyor ama tipik bir kural bunlarin
     * ancak birkacini kullaniyor; geri kalani bos kutu olarak akip gidiyor
     * ve dolu olani bulmak zorlasiyordu. Varsayilan olarak yalnizca DOLU
     * alanlar gorunur; bos olanlar tek tusla acilir.
     *
     * Gizleme `hidden` sinifiyla yapiliyor, kosullu render ile DEGIL:
     * alanlar DOM'da kalir, dolayisiyla acip kapatmak girdi durumunu ya da
     * odagi kaybetmez.
     */
    const [bosAlanlariGoster, setBosAlanlariGoster] = useState(false);
    const [editKey, setEditKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<PromoSpec | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newType, setNewType] = useState<'partner' | 'cash'>('partner');

    const { data: partnerBonusesRes } = useQuery({
        queryKey: ['partner-bonuses-list'],
        queryFn: () => dashboardApi.partnerBonusList({}),
        staleTime: 10 * 60 * 1000,
    });

    const { data: freebetsRes } = useQuery({
        queryKey: ['freebets-list'],
        queryFn: async () => {
            const res = await fetch('/api/admin/bonus/freebets');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });

    const { data: promosAutoRes } = useQuery({
        queryKey: ['promos-auto-list'],
        queryFn: async () => {
            const res = await fetch('/api/promos/auto?includeUnconfigured=true');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });

    const promos: any[] = useMemo(() => {
        const rowsFrom = (response: any): any[] => {
            const root = response?.Data ?? response?.Result ?? response;
            if (Array.isArray(root)) return root;
            if (Array.isArray(root?.Objects)) return root.Objects;
            if (Array.isArray(root?.Result)) return root.Result;
            return [];
        };
        const normalize = (bonus: any) => {
            const partnerBonusId = bonus?.PartnerBonusId ?? bonus?.CampaignId ?? bonus?.campaignId ?? null;
            return {
                ...bonus,
                Id: partnerBonusId ?? bonus?.Id ?? bonus?.ExternalId ?? bonus?.id ?? bonus?.templateId,
                PartnerBonusId: partnerBonusId,
                IsAssignable: bonus?.IsAssignable ?? partnerBonusId != null,
                Name: bonus?.Name ?? bonus?.title ?? bonus?.systemName ?? bonus?.name ?? 'Adsız Lynon Bonusu',
                lynonSource: bonus?.Type?.Name ?? bonus?.source ?? null,
                lynonParameters: bonus?.bonusBlocksConfiguration ?? bonus?.parameters ?? null,
            };
        };
        const partnerBonuses = rowsFrom(partnerBonusesRes).map(normalize);
        const freebets = rowsFrom(freebetsRes).map(normalize);
        const siteBonuses = rowsFrom(promosAutoRes?.Data?.promotions).map((p: any) => normalize({
            ...p,
            Id: p.backofficeId ?? p.platformBonusDefinitionId ?? p.id,
            Name: p.promoTitle ?? p.title,
            lynonParameters: p.rules,
        }));
        const unique = new Map<string, any>();
        [...partnerBonuses, ...freebets, ...siteBonuses].forEach((bonus) => {
            if (bonus.Id != null && String(bonus.Id).trim() !== '' && !unique.has(String(bonus.Id))) {
                unique.set(String(bonus.Id), bonus);
            }
        });
        return Array.from(unique.values());
    }, [partnerBonusesRes, freebetsRes, promosAutoRes]);

    const normalizeTitleForKey = (s: string): string =>
        String(s ?? '')
            .toLowerCase()
            .replace(/%/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const promoTitleByExternalId = useMemo(() => {
        const m = new Map<number, string>();
        for (const p of promos) {
            const id = p.Id != null && String(p.Id).trim() !== '' ? Number(p.Id) : NaN;
            if (Number.isFinite(id)) m.set(id, p.Name);
        }
        return m;
    }, [promos]);

    const promoTitleByNormalizedTitle = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of promos) {
            const k = normalizeTitleForKey(p.Name);
            if (k) m.set(k, p.Name);
        }
        return m;
    }, [promos]);

    const getPromoTitleForRuleKey = (key: string): string | null => {
        const k = String(key ?? '').trim();
        if (!k) return null;
        if (activeTab === 'id') {
            // Find by exact string match or numeric match
            const match = promos.find(p => String(p.Id).trim() === k);
            return match ? match.Name : null;
        }
        const norm = normalizeTitleForKey(k);
        if (!norm) return null;
        return promoTitleByNormalizedTitle.get(norm) ?? null;
    };

    const addOptions = useMemo(() => {
        if (!promos || promos.length === 0) return [];
        if (activeTab === 'id') {
            return promos
                .map((p) => {
                    const partnerId = p.PartnerBonusId != null && String(p.PartnerBonusId).trim() !== ''
                        ? Number(p.PartnerBonusId)
                        : undefined;
                    return {
                        value: partnerId != null && Number.isFinite(partnerId) ? String(partnerId) : '',
                        label: `${p.Name}${partnerId != null && Number.isFinite(partnerId) ? ` — Partner Bonus ID: ${partnerId}` : ' — Atanabilir kampanya ID bulunamadı'}`,
                        disabled: !(partnerId != null && Number.isFinite(partnerId)),
                    };
                })
                .filter((o) => o.value);
        }
        return promos
            .map((p) => {
                const key = normalizeTitleForKey(p.Name);
                return {
                    value: key,
                    label: p.Name,
                    disabled: !key,
                };
            })
                .filter((o) => o.value);
    }, [promos, activeTab]);

    const selectedBonusLabel = useMemo(() => {
        const key = String(newKey ?? '').trim();
        if (!key) return null;
        if (activeTab === 'id') {
            const id = Number(key);
            if (!Number.isFinite(id)) return null;
            return promoTitleByExternalId.get(id) ?? null;
        }
        // title mode: key is normalized title key
        const k = normalizeTitleForKey(key);
        return promoTitleByNormalizedTitle.get(k) ?? null;
    }, [newKey, activeTab, promoTitleByExternalId, promoTitleByNormalizedTitle]);

    const { data: config, isLoading } = useQuery<RulesConfig>({
        queryKey: ['admin-rules'],
        queryFn: async () => {
            const res = await fetch('/api/admin/rules');
            return res.json();
        },
    });

    const mutation = useMutation({
        mutationFn: async (newConfig: RulesConfig) => {
            const res = await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });
            const json = await res.json();
            if (!res.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Kurallar kaydedilemedi');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rules'] });
            toast.success('Kural motoru güncellendi', {
                icon: <Sparkles size={16} className="text-emerald-400" />,
                style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' }
            });
            setEditKey(null);
            setIsAdding(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Güncelleme sırasında hata oluştu');
        },
    });

    const handleUpdateRule = (key: string, spec: PromoSpec) => {
        if (!config) return;
        const newConfig = { ...config };
        const targetMap = activeTab === 'id' ? 'PROMO_SPECS' : 'PROMO_TITLE_SPECS';
        newConfig[targetMap] = { ...newConfig[targetMap], [key]: spec };
        mutation.mutate(newConfig);
    };

    /**
     * SILME ARTIK SATIRI GERCEKTEN KALDIRIR.
     *
     * Onceden kayit siliniyordu ama liste, Lynon katalogundaki her
     * kampanyayi kural kaydi olmasa da gosterdigi icin satir hemen bos bir
     * yer tutucu olarak geri geliyordu — disaridan "silinmiyor" gibi
     * gorunuyordu. Katalogda karsiligi olan bir ID silindiginde artik
     * gizlenenler listesine de yaziliyor.
     *
     * Karar GERI ALINABILIR: "gizlenenleri goster" ile listelenip geri
     * acilabilir. Kalici olarak kaybolsaydi yeni kampanya kesfetmenin tek
     * yolu kapanmis olurdu.
     */
    const handleDeleteRule = (key: string, spec?: PromoSpec) => {
        if (!config) return;

        /**
         * KURAL ANAHTARI ILE BONUS ID AYNI DEGIL.
         *
         * Ornek: kural anahtari `1874`, bagli oldugu Lynon kampanyasi
         * `2046`. Yalnizca anahtara bakmak bu kurallarda gizlemeyi sessizce
         * atliyordu: kayit siliniyor, satir 2046 yer tutucusu olarak geri
         * geliyordu. Kuralin SAHIPLENDIGI tum ID'ler gizlenir — anahtar,
         * `partnerBonusId` ve varsa yatirim araliklarindaki ID'ler.
         */
        const sahiplenilen = new Set<string>([String(key)]);
        const canliSpec = spec ?? (config.PROMO_SPECS?.[key] as PromoSpec | undefined);
        if (canliSpec?.partnerBonusId) sahiplenilen.add(String(canliSpec.partnerBonusId).trim());
        for (const aralik of canliSpec?.partnerBonusRanges ?? []) {
            if (aralik?.partnerBonusId) sahiplenilen.add(String(aralik.partnerBonusId).trim());
        }

        const katalogIdleri = new Set(promos.map((promo) => String(promo?.PartnerBonusId ?? '').trim()));
        const gizlenecek = [...sahiplenilen].filter((id) => id && katalogIdleri.has(id));

        const soru = gizlenecek.length > 0
            ? `${key} kuralı silinecek ve ilgili Lynon kampanyası (${gizlenecek.join(', ')}) listeden gizlenecek. "Gizlenenleri göster" ile geri alabilirsiniz. Devam edilsin mi?`
            : `${key} kuralını silmek istediğinize emin misiniz?`;
        if (!window.confirm(soru)) return;

        const newConfig = { ...config };
        const targetMap = activeTab === 'id' ? 'PROMO_SPECS' : 'PROMO_TITLE_SPECS';
        const updatedMap = { ...newConfig[targetMap] };
        delete updatedMap[key];
        newConfig[targetMap] = updatedMap;

        if (gizlenecek.length > 0 && activeTab === 'id') {
            newConfig.HIDDEN_PROMO_IDS = [...new Set([...(newConfig.HIDDEN_PROMO_IDS ?? []), ...gizlenecek])];
        }

        mutation.mutate(newConfig);
    };

    /** Gizlenen bir kampanyayi listeye geri getirir. */
    const handleUnhideRule = (key: string) => {
        if (!config) return;
        mutation.mutate({
            ...config,
            HIDDEN_PROMO_IDS: (config.HIDDEN_PROMO_IDS ?? []).filter((id) => String(id) !== String(key)),
        });
    };

    const handleAddRule = () => {
        if (!newKey.trim()) {
            toast.error('Giriş geçersiz');
            return;
        }
        handleUpdateRule(newKey.trim(), { type: newType, partnerBonusId: newType === 'partner' ? newKey.trim() : undefined, enabled: true });
        setNewKey('');
        setIsAdding(false);
    };

    /**
     * Hazır şablonu uygular.
     *
     * Kural ZATEN varsa `patch` alanları ÜZERİNE MERGE edilir — geri kalan
     * tüm alanlar (activeDays, checkSameDayUsage, isAutoCharge, ...)
     * dokunulmadan korunur; tam obje ile EZMEK, o an production'da olup da
     * bu preset'te taşınmayan alanları sessizce silerdi.
     */
    const handleApplyPreset = (preset: RulePreset) => {
        if (!config) return;
        const existing = config[preset.targetMap]?.[preset.key];
        const soru = existing
            ? `"${preset.label}" uygulanacak. "${preset.key}" kuralı zaten var; yalnızca bu şablonun değiştirdiği alanlar üzerine yazılır, diğerleri korunur. Devam edilsin mi?`
            : `"${preset.label}" yeni bir kural olarak oluşturulacak. Devam edilsin mi?`;
        if (!window.confirm(soru)) return;
        const merged: PromoSpec = { ...(existing ?? {}), ...preset.patch };
        const newConfig = { ...config };
        newConfig[preset.targetMap] = { ...newConfig[preset.targetMap], [preset.key]: merged };
        mutation.mutate(newConfig);
    };

    /**
     * Tutar hesabinin tabani: kayip bonusunda NET KAYIP, digerlerinde yatirim.
     * Etiketler buna gore degisiyor; sabit "Yatirim" yazmak kayip bonusunda
     * yanlis alani ayarladigi izlenimi veriyordu.
     */
    /** Alan dolu mu? Bos dizi ve bos metin "dolu" sayilmaz. */
    const alanDolu = (deger: unknown): boolean => {
        if (deger === undefined || deger === null || deger === '') return false;
        if (Array.isArray(deger)) return deger.length > 0;
        return true;
    };

    /**
     * Bos alani gizler; "bos alanlari goster" acikken hepsi gorunur.
     * `ek` izgara genisligi gibi alana ozel siniflar icin (gizliyken
     * gerekmez: `hidden` zaten display:none).
     */
    const alanSinifi = (deger: unknown, ek = ''): string =>
        (bosAlanlariGoster || alanDolu(deger)) ? `space-y-2 ${ek}`.trim() : 'hidden';

    /**
     * BOLUM BASLIGI, ICI BOSKEN GORUNMEZ.
     *
     * Bolumler acilir kapanir DEGIL — duz baslik + altinda alan izgarasi.
     * Bos alanlar gizlenince basliklar ALTI BOS kaliyordu ve disaridan
     * "bolum acilmiyor" gibi gorunuyordu. Bolumun tum alanlari bossa
     * basligiyla birlikte tamamen gizlenir; "+ N bos alan" ile hepsi
     * geri gelir.
     */
    const bolumSinifi = (degerler: unknown[]): string =>
        (bosAlanlariGoster || degerler.some(alanDolu))
            ? 'space-y-4 pt-4 border-t border-white/5'
            : 'hidden';

    /**
     * Su an gizlenen alan sayisi. `alanSinifi` ile sarilan alanlarin
     * listesiyle AYNI sirada tutulmali; ayrisirsa sayac yaniltir.
     */
    const gizliAlanSayisi = bosAlanlariGoster ? 0 : [
        editValue?.minBalanceToClaim, editValue?.maxBalanceToClaim,
        editValue?.principalWagerMult, editValue?.bonusWagerMult,
        editValue?.casinoWagering, editValue?.sportWagering,
        editValue?.minSportOdds, editValue?.maxPayoutMult, editValue?.maxPayoutFixed,
        editValue?.minDepositAmount, editValue?.maxDepositAmount,
        editValue?.perDayLimit, editValue?.perWeekLimit,
        editValue?.allowedProviders, editValue?.consecutiveLossDeposits,
        editValue?.balanceBelow, editValue?.startTime, editValue?.endTime,
    ].filter((deger) => !alanDolu(deger)).length;

    const tabanAdi = editValue?.lossBonus ? 'Kayıp' : 'Yatırım';
    const tabanAdiKucuk = editValue?.lossBonus ? 'kayıp' : 'yatırım';

    const filteredRules = useMemo<Array<[string, PromoSpec]>>(() => {
        if (!config) return [];
        const source = activeTab === 'id' ? config.PROMO_SPECS : config.PROMO_TITLE_SPECS;
        const merged = new Map<string, PromoSpec>(Object.entries(source) as Array<[string, PromoSpec]>);

        // Lynon kataloğundaki her kampanya, henüz kural kaydı olmasa da görünür.
        // GİZLENENLER hariç: silinen bir kampanyanın yer tutucusu geri gelirse
        // silme işlemi çalışmamış gibi görünüyordu.
        if (activeTab === 'id') {
            const gizli = new Set((config.HIDDEN_PROMO_IDS ?? []).map((id) => String(id)));
            for (const promo of promos) {
                const partnerBonusId = String(promo?.PartnerBonusId ?? '').trim();
                if (!partnerBonusId || merged.has(partnerBonusId)) continue;
                if (!gizlenenleriGoster && gizli.has(partnerBonusId)) continue;
                merged.set(partnerBonusId, {
                    enabled: false,
                    type: 'partner',
                    partnerBonusId,
                });
            }
        }

        const needle = searchTerm.toLocaleLowerCase('tr-TR').trim();
        return Array.from(merged.entries())
            .filter(([key, spec]) => {
                if (!needle) return true;
                // Kuralin kendi adi da aranabilmeli; nakit bonuslarda tek ad odur.
                const title = getPromoTitleForRuleKey(key) ?? '';
                return `${key} ${title} ${spec?.title ?? ''}`.toLocaleLowerCase('tr-TR').includes(needle);
            })
            .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], 'tr'));
    }, [config, activeTab, searchTerm, promos, promoTitleByNormalizedTitle, gizlenenleriGoster]);

    /** Gizlenen kampanya sayisi — sifirsa dugmeyi hic gostermiyoruz. */
    const gizliSayisi = (config?.HIDDEN_PROMO_IDS ?? []).length;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-40 space-y-4">
            <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-[color:var(--panel-accent,#0a84ff)]/20 border-t-[color:var(--panel-accent,#0a84ff)] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-purple-300 uppercase tracking-widest animate-pulse">Sistem Yükleniyor</p>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto space-y-10 py-6 animate-in fade-in duration-700">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 md:flex-row md:items-center md:justify-between md:p-8 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--panel-accent,#0a84ff)]/10 text-purple-300">
                        <Settings size={20} />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-white">Kural Merkezi</h1>
                        <p className="mt-0.5 text-xs font-medium text-slate-400">Bonus uygunluk kurallarını tanımlayın ve düzenleyin.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-rules'] })}
                        className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all hover:bg-white/10 active:scale-95"
                        aria-label="Yenile"
                    >
                        <RefreshCw size={17} className={cn("text-slate-400 group-hover:text-white transition-colors", mutation.isPending && "animate-spin")} />
                    </button>
                    <Button
                        variant="primary"
                        onClick={() => setIsAdding(!isAdding)}
                        className="h-10 rounded-xl bg-[color:var(--panel-accent,#0a84ff)] px-5 text-xs font-semibold tracking-wide text-white hover:bg-[color:var(--panel-accent-deep,#0060df)]"
                    >
                        <Plus size={16} className="mr-1.5" /> Yeni Kural Ekle
                    </Button>
                </div>
            </header>

            <div className="rounded-3xl border border-[color:var(--panel-accent,#0a84ff)]/20 bg-white/[0.02] p-8 md:p-8 space-y-4 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-purple-300" />
                    <div>
                        <h2 className="text-sm font-semibold text-white">Hazır Şablonlar</h2>
                        <p className="text-[10px] font-medium text-slate-400">Tek tıkla kur; var olan bir kuralı düzeltiyorsa yalnızca ilgili alan değişir, diğerleri korunur.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {RULE_PRESETS.map((preset) => {
                        const existing = config?.[preset.targetMap]?.[preset.key];
                        return (
                            <div key={preset.key} className="flex flex-col gap-3 rounded-3xl border border-white/[0.05] bg-black/20 p-8 backdrop-blur-xl">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
                                            existing ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                                        )}>
                                            {existing ? 'Düzeltme' : 'Yeni Kural'}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">{preset.key}</span>
                                    </div>
                                    <p className="mt-1.5 text-xs font-semibold text-white">{preset.label}</p>
                                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{preset.description}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleApplyPreset(preset)}
                                    disabled={mutation.isPending}
                                    className="h-9 text-[10px] font-semibold border border-[color:var(--panel-accent,#0a84ff)]/30 text-purple-300 hover:bg-[color:var(--panel-accent,#0a84ff)]/10"
                                >
                                    {existing ? 'Düzeltmeyi Uygula' : 'Kuralı Oluştur'} <ArrowRight size={12} className="ml-1.5" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="lg:col-span-9 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-300 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Kural veya ID ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-14 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-3xl pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-accent,#0a84ff)]/20 focus:border-[color:var(--panel-accent,#0a84ff)]/20 transition-all font-bold"
                            />
                        </div>
                        {/*
                          Gizleme geri alinabilir olsun diye: sifir gizli varsa
                          dugme hic gorunmez, gurultu yapmaz.
                        */}
                        {activeTab === 'id' && gizliSayisi > 0 && (
                            <button
                                type="button"
                                onClick={() => setGizlenenleriGoster((v) => !v)}
                                aria-pressed={gizlenenleriGoster}
                                className={cn(
                                    'h-14 shrink-0 rounded-3xl border px-6 text-[11px] font-bold uppercase tracking-widest backdrop-blur-xl transition-all',
                                    gizlenenleriGoster
                                        ? 'border-amber-300/40 bg-amber-400/15 text-amber-200'
                                        : 'border-white/[0.05] bg-white/[0.02] text-slate-400 hover:text-white'
                                )}
                            >
                                {gizlenenleriGoster ? 'Gizlenenleri gizle' : `Gizlenenleri göster (${gizliSayisi})`}
                            </button>
                        )}
                    </div>

                    <AnimatePresence>
                        {isAdding && (
                            <motion.div
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                className="relative group"
                            >
                                <div className="relative p-8 rounded-3xl bg-white/[0.02] border border-[color:var(--panel-accent,#0a84ff)]/20 overflow-hidden backdrop-blur-xl">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Plus size={80} className="text-purple-300" />
                                    </div>
                                    <div className="relative z-10 flex flex-col gap-8">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-[color:var(--panel-accent,#0a84ff)]/10 flex items-center justify-center text-purple-300">
                                                <Plus size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-white uppercase tracking-tight">YENİ BONUS KURALI TANIMLA</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{activeTab === 'id' ? 'Platform ID Bazlı Mapping' : 'Başlık Bazlı Mapping'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Tür Seçimi */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Bonus Tipi (Hangi yöntemle eklenecek?)</label>
                                                <div className="grid grid-cols-2 gap-8">
                                                    <button
                                                        onClick={() => setNewType('partner')}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 h-14 rounded-3xl border font-semibold text-[11px] transition-all uppercase tracking-widest backdrop-blur-xl",
                                                            newType === 'partner'
                                                                ? "bg-[color:var(--panel-accent,#0a84ff)]/20 border-[color:var(--panel-accent,#0a84ff)]/50 text-purple-300"
                                                                : "bg-black/20 border-white/5 text-slate-400 hover:border-white/5"
                                                        )}
                                                    >
                                                        <Gift size={16} /> Platform Bonusu
                                                    </button>
                                                    <button
                                                        onClick={() => setNewType('cash')}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 h-14 rounded-3xl border font-semibold text-[11px] transition-all uppercase tracking-widest backdrop-blur-xl",
                                                            newType === 'cash'
                                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                                : "bg-black/20 border-white/5 text-slate-400 hover:border-white/5"
                                                        )}
                                                    >
                                                        <Sparkles size={16} /> Nakit Ekleme
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">
                                                    {newType === 'partner' ? 'Platform Bonus ID' : 'Referans ID / Tanımlayıcı'}
                                                </label>
                                                {newType === 'partner' ? (
                                                    <select
                                                        value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        className="w-full h-16 bg-black/40 border border-[color:var(--panel-accent,#0a84ff)]/25 rounded-3xl px-5 text-sm text-white focus:outline-none focus:border-[color:var(--panel-accent,#0a84ff)]/70 transition-all font-semibold backdrop-blur-xl"
                                                    >
                                                        <option value="">Lynon kampanyası seçin ({promos.length})</option>
                                                        {addOptions.map((option) => (
                                                            <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                                                        placeholder="Bir isim veya ID girin"
                                                        className="w-full h-16 bg-black/40 border border-white/[0.05] rounded-3xl px-6 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all font-semibold backdrop-blur-xl"
                                                    />
                                                )}
                                                <p className="text-[10px] text-slate-500 font-bold ml-1 uppercase tracking-wider">
                                                    {newType === 'partner'
                                                        ? 'Lynon’dan gelen aktif kampanyayı seçin; kampanya blok ve şablon parametreleri atama anında Lynon’dan okunur.'
                                                        : 'Kuralı tanımlamak için kullanılacak benzersiz bir anahtar girin.'}
                                                </p>
                                            </div>
                                        </div>

                                        {selectedBonusLabel && (
                                            <div className="p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3 backdrop-blur-xl">
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                                <p className="text-sm font-semibold text-emerald-400">Hedef Bonus: {selectedBonusLabel}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                                            <button onClick={() => setIsAdding(false)} className="px-8 py-3 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors">İPTAL</button>
                                            <Button variant="primary" onClick={handleAddRule} className="h-12 px-12 rounded-3xl bg-[color:var(--panel-accent,#0a84ff)] text-white font-semibold text-[11px] shadow-2xl border-none hover:bg-[color:var(--panel-accent-deep,#0060df)] backdrop-blur-xl">KURALI OLUŞTUR</Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 gap-8">
                        {filteredRules.map(([key, spec]) => (
                            <div
                                key={key}
                                className={cn(
                                    "relative rounded-3xl border transition-all duration-300 backdrop-blur-xl",
                                    editKey === key
                                        ? "bg-[color:var(--panel-accent,#0a84ff)]/5 border-[color:var(--panel-accent,#0a84ff)]/50 p-8"
                                        : "bg-white/[0.02] border-white/5 hover:border-white/5 p-6 md:px-8 group"
                                )}
                            >
                                <AnimatePresence mode="wait">
                                    {editKey === key ? (
                                        <motion.div key="edit" initial={{ opacity: 0, scale: 0.99, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="space-y-12">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/5">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-16 w-16 rounded-[20px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-purple-300 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
                                                        <FileCode size={32} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-3xl font-semibold text-white tracking-tighter">{key}</h3>
                                                            {spec.enabled === false && <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[9px] font-semibold border border-rose-500/20 uppercase tracking-widest">Pasif</span>}
                                                        </div>
                                                         {getPromoTitleForRuleKey(key) && (
                                                            <div className="text-sm font-bold text-emerald-400/90 flex items-center gap-2">
                                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                                {getPromoTitleForRuleKey(key)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    {/*
                                                      Gizli alan sayisi ekranda yazar: kullanici neyin
                                                      saklandigini bilmeden karar veremez.
                                                    */}
                                                    {gizliAlanSayisi > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setBosAlanlariGoster(true)}
                                                            className="h-12 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
                                                        >
                                                            + {gizliAlanSayisi} boş alan
                                                        </button>
                                                    )}
                                                    {bosAlanlariGoster && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setBosAlanlariGoster(false)}
                                                            className="h-12 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
                                                        >
                                                            Boşları gizle
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setEditKey(null)}
                                                        className="px-6 py-3 rounded-xl bg-white/5 text-[11px] font-semibold text-slate-400 hover:text-white transition-all uppercase tracking-widest"
                                                    >
                                                        İPTAL
                                                    </button>
                                                    <Button
                                                        variant="primary"
                                                        onClick={() => handleUpdateRule(key, editValue!)}
                                                        className="h-12 px-10 rounded-3xl bg-gradient-to-r from-[color:var(--panel-accent,#0a84ff)] to-[color:var(--panel-accent,#0a84ff)] font-semibold text-[11px] border-none shadow-xl shadow-[color:var(--panel-accent,#0a84ff)]/10 uppercase tracking-widest backdrop-blur-xl"
                                                        disabled={mutation.isPending}
                                                    >
                                                        {mutation.isPending ? 'KAYDEDİLİYOR...' : 'KURALI GÜNCELLE'}
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Advanced Rule Engine Sections */}
                                            <div className="space-y-8">
                                                {/* Section: Type & Amount */}
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-semibold text-purple-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" />
                                                        Tür & Tutar Ayarları
                                                    </h4>
                                                    <div className="mb-4">
                                                        <ToggleField
                                                            label="Kural aktif"
                                                            description="Kapalıyken bu bonus hiç verilmez: listede görünse bile talep reddedilir."
                                                            value={editValue?.enabled}
                                                            onChange={(value) => setEditValue({ ...editValue, enabled: value })}
                                                        />
                                                    </div>
                                                    {/*
                                                      * BONUS ADI.
                                                      *
                                                      * Kart basligi kurala Lynon kampanya katalogundan isim
                                                      * ariyordu (getPromoTitleForRuleKey). Nakit bonuslarin
                                                      * Lynon'da kampanyasi YOK, dolayisiyla adi hic
                                                      * gorunmuyordu ve degistirilemiyordu — kartta yalnizca
                                                      * ham anahtar kaliyordu.
                                                      */}
                                                    <div className="mb-4 space-y-2">
                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Bonus Adı</label>
                                                        <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">
                                                            Panelde ve oyuncu tarafında görünen ad. Boş bırakılırsa
                                                            {activeTab === 'id' ? ' Lynon kampanya adı' : ' kural anahtarı'} kullanılır.
                                                        </p>
                                                        <input
                                                            type="text"
                                                            value={editValue?.title ?? ''}
                                                            onChange={(e) => setEditValue({ ...editValue, title: e.target.value })}
                                                            placeholder={getPromoTitleForRuleKey(key) ?? key}
                                                            className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Bonus Tipi</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonusun hangi mekanizma ile ekleneceğini belirler.</p>
                                                            <select
                                                                value={editValue?.type ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, type: e.target.value as any })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                            >
                                                                <option value="">Seçiniz...</option>
                                                                <option value="partner">Partner Bonus</option>
                                                                <option value="cash">Nakit Ekleme</option>
                                                            </select>
                                                        </div>
                                                        {editValue?.type === 'partner' && (() => {
                                                            const araliklar = editValue?.partnerBonusRanges ?? [];
                                                            const araliklariYaz = (yeni: typeof araliklar) =>
                                                                setEditValue({ ...editValue, partnerBonusRanges: yeni });
                                                            return (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Partner Bonus ID</label>
                                                                <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">
                                                                    {araliklar.length > 0
                                                                        ? 'Aralıklar tanımlı; bu alan kullanılmaz. Verilecek bonusu aşağıdaki kademeler belirler.'
                                                                        : 'Backoffice üzerindeki bonusun benzersiz tanımlayıcısı.'}
                                                                </p>
                                                                <input
                                                                    type="text"
                                                                    value={editValue?.partnerBonusId ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, partnerBonusId: e.target.value })}
                                                                    disabled={araliklar.length > 0}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl disabled:opacity-40"
                                                                    placeholder="Örn: 656569"
                                                                />

                                                                {/*
                                                                  YATIRIM ARALIĞINA GÖRE BONUS ID.
                                                                  Aynı kampanyanın kademeleri Lynon'da ayrı bonus
                                                                  tanımları olabiliyor. Oyuncu listede tek bonus görür;
                                                                  hangisinin verileceğini yatırım tutarı belirler.
                                                                */}
                                                                <div className="mt-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-xl">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Yatırım aralığına göre bonus</p>
                                                                            <p className="mt-1 text-[10px] font-medium text-slate-500">
                                                                                Kademe eklerseniz verilecek bonus, oyuncunun son yatırım tutarına göre seçilir.
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => araliklariYaz([...araliklar, { min: '', max: '', partnerBonusId: '' }])}
                                                                            className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/[0.08]"
                                                                        >
                                                                            + Kademe
                                                                        </button>
                                                                    </div>

                                                                    {araliklar.length === 0 ? (
                                                                        <p className="mt-3 text-[10px] font-medium text-slate-600">
                                                                            Kademe yok — yukarıdaki tek ID kullanılır.
                                                                        </p>
                                                                    ) : (
                                                                        <div className="mt-3 space-y-2">
                                                                            {araliklar.map((aralik, i) => (
                                                                                <div key={i} className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="number"
                                                                                        value={aralik.min ?? ''}
                                                                                        onChange={(e) => araliklariYaz(araliklar.map((a, j) => j === i ? { ...a, min: e.target.value } : a))}
                                                                                        placeholder="Alt"
                                                                                        className="h-11 w-full min-w-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-4 text-xs font-bold text-white outline-none transition focus:border-[color:var(--panel-accent,#0a84ff)]"
                                                                                    />
                                                                                    <span className="shrink-0 text-[10px] font-bold text-slate-600">–</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        value={aralik.max ?? ''}
                                                                                        onChange={(e) => araliklariYaz(araliklar.map((a, j) => j === i ? { ...a, max: e.target.value } : a))}
                                                                                        placeholder="Üst (boş = sınırsız)"
                                                                                        className="h-11 w-full min-w-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-4 text-xs font-bold text-white outline-none transition focus:border-[color:var(--panel-accent,#0a84ff)]"
                                                                                    />
                                                                                    <span className="shrink-0 text-[10px] font-bold text-slate-600">→</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={aralik.partnerBonusId ?? ''}
                                                                                        onChange={(e) => araliklariYaz(araliklar.map((a, j) => j === i ? { ...a, partnerBonusId: e.target.value } : a))}
                                                                                        placeholder="Bonus ID"
                                                                                        className="h-11 w-full min-w-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-4 text-xs font-bold text-white outline-none transition focus:border-[color:var(--panel-accent,#0a84ff)]"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => araliklariYaz(araliklar.filter((_, j) => j !== i))}
                                                                                        aria-label="Kademeyi sil"
                                                                                        className="shrink-0 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-300 transition hover:bg-rose-400/20"
                                                                                    >
                                                                                        Sil
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                            <p className="pt-1 text-[10px] font-medium text-slate-600">
                                                                                Aralıklar çakışamaz ve boşluğa düşen yatırım bonus almaz — kaydederken doğrulanır.
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            );
                                                        })()}
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Tutar Tipi</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Eklenecek miktarın nasıl hesaplanacağını seçin.</p>
                                                            {/* BonusMoneyAmount ham haritada tanimliysa buradaki hesap HIC
                                                                uygulanmiyor (dashboard.ts birlestirmesi). Sessizdi. */}
                                                            {(editValue?.assignmentValues as Record<string, unknown> | undefined)?.BonusMoneyAmount != null && (
                                                                <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-300">
                                                                    Atama Değerleri’nde BonusMoneyAmount sabit tanımlı. Bu hesaplama uygulanmaz; tutarı oradan silin ya da oradan yönetin.
                                                                </p>
                                                            )}
                                                            <select
                                                                value={editValue?.amountType ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, amountType: e.target.value as any })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                            >
                                                                <option value="">Seçiniz...</option>
                                                                <option value="fixed">Sabit Tutar</option>
                                                                <option value="percentage">Yatırım Yüzdesi</option>
                                                                <option value="full">Tam Yatırım</option>
                                                                <option value="tiered">Baremli Tutar</option>
                                                                <option value="tieredRange">Baremli Yatırım Aralığı</option>
                                                                <option value="tieredPercentage">{`Yüzdeli ${tabanAdi} Baremi Aralığı`}</option>
                                                                <option value="dailySequencePercentage">Günlük Yatırım Sırası Kademesi</option>
                                                                <option value="averageOfLastDeposits">Son N Yatırımın Ortalaması</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                                        {editValue?.amountType === 'fixed' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Sabit Tutar (₺)</label>
                                                                <input
                                                                    type="number"
                                                                    value={editValue?.fixedAmount ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, fixedAmount: Number(e.target.value) })}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                                />
                                                            </div>
                                                        )}
                                                        {editValue?.amountType === 'percentage' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Yüzde (%)</label>
                                                                <input
                                                                    type="number"
                                                                    value={editValue?.percentageAmount ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, percentageAmount: Number(e.target.value) })}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                                />
                                                            </div>
                                                        )}
                                                            {editValue?.amountType === 'averageOfLastDeposits' && (
                                                                <>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Ortalamaya Girecek Yatırım Sayısı</label>
                                                                        <input type="number" placeholder="Örn: 3"
                                                                            value={editValue?.averageDepositCount ?? ''}
                                                                            onChange={(e) => setEditValue({ ...editValue, averageDepositCount: Number(e.target.value) })}
                                                                            className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Alt Sınır (₺)</label>
                                                                        <input type="number" placeholder="Örn: 100"
                                                                            value={editValue?.minimumBonus ?? ''}
                                                                            onChange={(e) => setEditValue({ ...editValue, minimumBonus: Number(e.target.value) })}
                                                                            className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Üst Sınır (₺)</label>
                                                                        <input type="number" placeholder="Örn: 2000"
                                                                            value={editValue?.maximumBonus ?? ''}
                                                                            onChange={(e) => setEditValue({ ...editValue, maximumBonus: Number(e.target.value) })}
                                                                            className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {editValue?.amountType === 'dailySequencePercentage' && (
                                                            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] space-y-3 backdrop-blur-xl">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Günlük Yatırım Sırası Kademeleri</label>
                                                                <p className="text-[10px] text-slate-500 font-medium pl-1">
                                                                    Virgülle ayrılmış yüzdeler. Soldan sağa günün 1., 2., 3. ... yatırımına uygulanır;
                                                                    listeden sonraki yatırımlar bonus almaz. Örn: 20, 40, 60, 80, 100
                                                                </p>
                                                                <input type="text" placeholder="20, 40, 60, 80, 100"
                                                                    value={(editValue?.dailySequencePercents ?? []).join(', ')}
                                                                    onChange={(e) => setEditValue({
                                                                        ...editValue,
                                                                        dailySequencePercents: e.target.value
                                                                            .split(',')
                                                                            .map((parca) => Number(parca.trim()))
                                                                            .filter((sayi) => Number.isFinite(sayi) && sayi > 0),
                                                                    })}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                                {(editValue?.dailySequencePercents ?? []).length > 0 && (
                                                                    <p className="text-[10px] text-slate-400 font-medium pl-1">
                                                                        {(editValue?.dailySequencePercents ?? []).length} kademe · toplam %
                                                                        {(editValue?.dailySequencePercents ?? []).reduce((a, b) => a + b, 0)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {editValue?.amountType === 'tiered' && (
                                                        <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] space-y-4 backdrop-blur-xl">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Barem Ayarları</label>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredAmounts: [...(editValue?.tieredAmounts || []), { min: 0, bonus: 0 }] })}
                                                                    className="text-[10px] h-7 px-3"
                                                                >
                                                                    + Barem Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredAmounts || []).map((tier, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-center">
                                                                        <input
                                                                            type="number"
                                                                            placeholder={`Min ${tabanAdi}`}
                                                                            value={tier.min}
                                                                            onChange={(e) => {
                                                                                const newTiers = [...(editValue.tieredAmounts || [])];
                                                                                newTiers[idx].min = Number(e.target.value);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                        />
                                                                        <ArrowRight size={14} className="text-slate-500" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Bonus"
                                                                            value={tier.bonus}
                                                                            onChange={(e) => {
                                                                                const newTiers = [...(editValue.tieredAmounts || [])];
                                                                                newTiers[idx].bonus = Number(e.target.value);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newTiers = (editValue.tieredAmounts || []).filter((_, i) => i !== idx);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="p-2 text-slate-400 hover:text-rose-500"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {editValue?.amountType === 'tieredRange' && (
                                                        <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] space-y-4 backdrop-blur-xl">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Yatırım Aralığı Ayarları</label>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredRanges: [...(editValue?.tieredRanges || []), { min: 0, max: 0, bonus: 0 }] })}
                                                                    className="text-[10px] h-7 px-3"
                                                                >
                                                                    + Aralık Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredRanges || []).map((range, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-center">
                                                                        <input
                                                                            type="number"
                                                                            placeholder={`Min ${tabanAdi}`}
                                                                            value={range.min}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], min: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                        />
                                                                        <ArrowRight size={14} className="text-slate-500" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder={`Max ${tabanAdi}`}
                                                                            value={range.max}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], max: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                        />
                                                                        <ArrowRight size={14} className="text-slate-500" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Bonus"
                                                                            value={range.bonus}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], bonus: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newRanges = (editValue.tieredRanges || []).filter((_, i) => i !== idx);
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="p-2 text-slate-400 hover:text-rose-500"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] space-y-3 backdrop-blur-xl">
                                                        <ToggleField
                                                            label="Kayıp bonusu (taban: net kayıp)"
                                                            description="Açıkken bonus tutarı yatırıma değil oyuncunun NET KAYBINA göre hesaplanır. Kademeli yüzde kullanan kayıp bonuslarında bu şart; kapalı bırakılırsa baremler son yatırıma uygulanır ve tutar yanlış çıkar."
                                                            value={editValue?.lossBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, lossBonus: v })}
                                                        />
                                                        {editValue?.lossBonus && (
                                                            <div className="pl-1">
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Kayıp Dönemi</label>
                                                                <select
                                                                    value={editValue?.lossBonusPeriod ?? 'sinceLastWithdrawal'}
                                                                    onChange={(e) => setEditValue({ ...editValue, lossBonusPeriod: e.target.value as any })}
                                                                    className="w-full h-11 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl"
                                                                >
                                                                    <option value="sinceLastWithdrawal">Son ödenen çekimden itibaren (ömür boyu birikebilir)</option>
                                                                    <option value="last24h">Son 24 saat (yalnızca son 24 saatteki yatırım ve çekim)</option>
                                                                    <option value="weekly">Haftalık (Pazartesi 00:00'da sıfırlanır)</option>
                                                                </select>
                                                                <p className="mt-1 text-[10px] text-slate-500">
                                                                    {editValue?.lossBonusPeriod === 'last24h'
                                                                        ? 'Net kayıp yalnızca son 24 saatteki yatırım ve çekimlerden hesaplanır; kayan pencere, gece yarısı sıfırlanmaz. Bu süre içinde çekim yapıldıysa taban o çekimden sonrasına daralır.'
                                                                        : editValue?.lossBonusPeriod === 'weekly'
                                                                            ? 'Net kayıp o Türkiye haftasıyla (ve varsa hafta içindeki bir çekimle) sınırlanır; her Pazartesi sıfırdan başlar.'
                                                                            : 'Net kayıp son ödenen çekimden itibaren hesaplanır ve ömür boyu birikebilir; oyuncunun aylar önceki kaybı da tabana girer.'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {editValue?.amountType === 'tieredPercentage' && (
                                                        <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] space-y-4 backdrop-blur-xl">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">{`Yüzdeli ${tabanAdi} Baremi Aralığı`}</label>
                                                                    <p className="mt-1 pl-1 text-[10px] text-slate-500">{`${tabanAdi} aralığa düşerse bonus, sabit tutar yerine ${tabanAdiKucuk} tutarının yüzdesi olarak hesaplanır. Tavan boş bırakılırsa sınır uygulanmaz.`}</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredPercentageRanges: [...(editValue?.tieredPercentageRanges || []), { min: 0, max: 0, percent: 0 }] })}
                                                                    className="text-[10px] h-7 px-3 shrink-0"
                                                                >
                                                                    + Aralık Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredPercentageRanges || []).map((range, idx) => {
                                                                    const update = (patch: Partial<{ min: number; max: number; percent: number; maxBonus?: number }>) => {
                                                                        const next = [...(editValue.tieredPercentageRanges || [])];
                                                                        next[idx] = { ...next[idx], ...patch };
                                                                        setEditValue({ ...editValue, tieredPercentageRanges: next });
                                                                    };
                                                                    return (
                                                                        <div key={idx} className="flex gap-2 items-center">
                                                                            <input
                                                                                type="number"
                                                                                placeholder={`Min ${tabanAdi}`}
                                                                                value={range.min}
                                                                                onChange={(e) => update({ min: Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                            />
                                                                            <ArrowRight size={14} className="text-slate-500 shrink-0" />
                                                                            <input
                                                                                type="number"
                                                                                placeholder={`Max ${tabanAdi}`}
                                                                                value={range.max}
                                                                                onChange={(e) => update({ max: Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                            />
                                                                            <ArrowRight size={14} className="text-slate-500 shrink-0" />
                                                                            <div className="relative flex-1">
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="Yüzde"
                                                                                    value={range.percent}
                                                                                    onChange={(e) => update({ percent: Number(e.target.value) })}
                                                                                    className="w-full h-10 bg-black/40 border border-white/[0.05] rounded-3xl pl-6 pr-3 text-xs text-white backdrop-blur-xl"
                                                                                />
                                                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">%</span>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Tavan (ops.)"
                                                                                value={range.maxBonus ?? ''}
                                                                                onChange={(e) => update({ maxBonus: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-white/[0.05] rounded-3xl px-3 text-xs text-white backdrop-blur-xl"
                                                                            />
                                                                            <button
                                                                                onClick={() => setEditValue({ ...editValue, tieredPercentageRanges: (editValue.tieredPercentageRanges || []).filter((_, i) => i !== idx) })}
                                                                                className="p-2 text-slate-400 hover:text-rose-500 shrink-0"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Lynon F: Process FreeSpin */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <div>
                                                        <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                                            Freespin / F: Process FreeSpin
                                                        </h4>
                                                        <p className="mt-1 text-[10px] text-slate-500">Bet Level ve Count ile birlikte Game ID ve Provider ID zorunludur. Lynon bu değerleri F: Process FreeSpin bloğuna gönderir.</p>
                                                        {/* Ayni deger iki yerden gelebiliyor: buradaki alanlar ve asagidaki
                                                            ham Atama Degerleri haritasi. Oncelik buradaki alanlarda, ama
                                                            bu hicbir yerde yazmiyordu; admin ham haritayi duzeltip
                                                            degisiklik neden islemedi diye ariyordu. */}
                                                        {(() => {
                                                            const ham = (editValue?.assignmentValues ?? {}) as Record<string, unknown>;
                                                            const ezilen: string[] = [];
                                                            if (ham.BetLevel != null && editValue?.freespinBetLevel != null) ezilen.push('BetLevel');
                                                            if (ham.RoundCount != null && editValue?.freespinCount != null) ezilen.push('RoundCount');
                                                            if (ham.Game != null && editValue?.freespinGameId != null && editValue?.freespinGameProviderId != null) ezilen.push('Game');
                                                            if (ezilen.length === 0) return null;
                                                            return (
                                                                <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-300">
                                                                    Atama Değerleri’nde de tanımlı: {ezilen.join(', ')}. Buradaki alanlar önceliklidir; oradaki değer gönderilmez.
                                                                </p>
                                                            );
                                                        })()}
                                                        {/* Yarim doldurulmus oyun secimi Lynon tarafindan reddedilir. */}
                                                        {(editValue?.freespinGameId != null) !== (editValue?.freespinGameProviderId != null) && (
                                                            <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-[10px] font-semibold text-rose-300">
                                                                Game ID ve Provider ID birlikte doldurulmalı. Yalnızca biri girilirse oyun seçimi hiç gönderilmez.
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Bet Level*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinBetLevel ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinBetLevel: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 1"
                                                                className="h-10 w-full rounded-3xl border border-white/[0.05] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40 backdrop-blur-xl"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Count*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinCount ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinCount: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 100"
                                                                className="h-10 w-full rounded-3xl border border-white/[0.05] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40 backdrop-blur-xl"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Game ID*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinGameId ?? (editValue?.freespinGame as any)?.id ?? (editValue?.freespinGame as any)?.Id ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinGameId: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 195202"
                                                                className="h-10 w-full rounded-3xl border border-white/[0.05] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40 backdrop-blur-xl"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Provider ID*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinGameProviderId ?? (editValue?.freespinGame as any)?.providerId ?? (editValue?.freespinGame as any)?.ProviderId ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinGameProviderId: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 1"
                                                                className="h-10 w-full rounded-3xl border border-white/[0.05] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40 backdrop-blur-xl"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* Section: Automation & Rules */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                        Otomasyon Ayarları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <ToggleField
                                                            label="Operatör onayı gerekmesin"
                                                            description="Açıkken talep doğrudan platforma işlenir. Kapalıyken bir operatörün elle onaylaması gerekir."
                                                            value={editValue?.isAutoCharge}
                                                            onChange={(v) => setEditValue({ ...editValue, isAutoCharge: v })}
                                                        />
                                                        <ToggleField
                                                            label="Dünkü yatırımlara göre hesapla"
                                                            description="Tutar son yatırıma değil, DÜNÜN toplam yatırımına göre hesaplanır (Türkiye saati)."
                                                            value={editValue?.isNextDayBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, isNextDayBonus: v, autoGrantNextDayAt0015: v ? editValue?.autoGrantNextDayAt0015 : false })}
                                                        />
                                                        <ToggleField
                                                            label="Her gece 00:15'te kendiliğinden dağıt"
                                                            description="Uygun oyuncular gece 00:15'te taranır ve bonus tanımlanır. Aynı oyuncuya iki kez verilmez."
                                                            value={editValue?.autoGrantNextDayAt0015}
                                                            onChange={(v) => setEditValue({ ...editValue, isNextDayBonus: v ? true : editValue?.isNextDayBonus, autoGrantNextDayAt0015: v })}
                                                        />                                                        <ToggleField
                                                            label="Kayıp bonusu hesabına girmesin"
                                                            description="Bu bonusla kullanılan yatırımlar, kayıp bonusu hesaplanırken sayılmaz — oyuncu aynı parayı iki kez kazanmasın."
                                                            value={editValue?.excludeFromLossCalculations}
                                                            onChange={(v) => setEditValue({ ...editValue, excludeFromLossCalculations: v })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section: Rule Engine Switches */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <h4 className="text-[10px] font-semibold text-sky-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                                        Bağımsız Kural Kontrolleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <ToggleField
                                                            label="Bekleyen çekimi olana verme"
                                                            description="Oyuncunun onay bekleyen bir çekim talebi varsa bonus reddedilir."
                                                            value={editValue?.checkPendingWithdrawal}
                                                            onChange={(v) => setEditValue({ ...editValue, checkPendingWithdrawal: v })}
                                                        />
                                                        <ToggleField
                                                            label="Son işlemi yatırım olsun"
                                                            description="Oyuncunun en son işlemi yatırım değilse (örneğin çekimse) bonus reddedilir."
                                                            value={editValue?.checkLastTransactionIsDeposit}
                                                            onChange={(v) => setEditValue({ ...editValue, checkLastTransactionIsDeposit: v })}
                                                        />
                                                        <ToggleField
                                                            label="Bir yatırıma bir bonus"
                                                            description="Aynı yatırım ikinci bir bonus için kullanılamaz. Kapatırsanız oyuncu tek yatırımla birden fazla bonus alabilir."
                                                            value={editValue?.checkSingleInvestmentUsage}
                                                            onChange={(v) => setEditValue({ ...editValue, checkSingleInvestmentUsage: v })}
                                                        />
                                                        <ToggleField
                                                            label="Günde bir kez"
                                                            description="Oyuncu bu bonusu aynı gün ikinci kez alamaz."
                                                            value={editValue?.checkSameDayUsage}
                                                            onChange={(v) => setEditValue({ ...editValue, checkSameDayUsage: v })}
                                                        />
                                                        <ToggleField
                                                            label="Yalnızca hiç işlem yapmamışlar"
                                                            description="Yatırımı, çekimi ve bahsi olmayan yeni üyelere verilir. Bir kez bile işlem yapmış oyuncu alamaz."
                                                            value={editValue?.onlyNewUsersNoDepositNoWithdraw}
                                                            onChange={(v) => setEditValue({ ...editValue, onlyNewUsersNoDepositNoWithdraw: v })}
                                                        />
                                                        <ToggleField
                                                            label="Telefonu onaylı olsun"
                                                            description="Telefon numarası doğrulanmamış oyuncu bu bonusu alamaz."
                                                            value={editValue?.requiresPhoneVerified}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresPhoneVerified: v })}
                                                        />
                                                        <ToggleField
                                                            label="Telegram kanalına üye olsun"
                                                            description="Bonus verilmeden önce oyuncunun Telegram kanalına üyeliği canlı sorgulanır. Hesabını bağlamamış veya kanaldan ayrılmış oyuncu alamaz."
                                                            value={editValue?.requiresTelegramMember}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresTelegramMember: v })}
                                                        />
                                                        <ToggleField
                                                            label="E-postası onaylı olsun"
                                                            description="E-posta adresi doğrulanmamış oyuncu bu bonusu alamaz."
                                                            value={editValue?.requiresEmailVerified}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresEmailVerified: v })}
                                                        />
                                                        <ToggleField
                                                            label="Aynı IP'den ikinci hesaba verme"
                                                            description="Son giriş IP'sini paylaşan başka bir hesap varsa bonus reddedilir — çoklu hesap şüphesi."
                                                            value={editValue?.checkIPDuplicate}
                                                            onChange={(v) => setEditValue({ ...editValue, checkIPDuplicate: v })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section: Limits */}
                                                <div className={bolumSinifi([editValue?.minBalanceToClaim, editValue?.maxBalanceToClaim])}>
                                                    <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Gelişmiş Limitler
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                                        <div className={alanSinifi(editValue?.minBalanceToClaim)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Min Bakiye Limiti</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonus talebi anındaki minimum bakiye sınırı.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.minBalanceToClaim ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minBalanceToClaim: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="N/A"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.maxBalanceToClaim)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Max Bakiye Limiti</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonus talebi anındaki maksimum bakiye sınırı.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxBalanceToClaim ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxBalanceToClaim: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="N/A"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Wager & Payout Rules */}
                                                <div className={bolumSinifi([editValue?.principalWagerMult, editValue?.bonusWagerMult, editValue?.casinoWagering, editValue?.sportWagering, editValue?.minSportOdds, editValue?.maxPayoutMult, editValue?.maxPayoutFixed])}>
                                                    <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Çevrim & Ödeme Kuralları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                                        <div className={alanSinifi(editValue?.principalWagerMult)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Ana Para Çevrimi</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Anaparanın kaç katı çevrilmeli?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.principalWagerMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, principalWagerMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="0 (çevrim şartı yok)"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.bonusWagerMult)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Bonus Çevrimi</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonusun kaç katı çevrilmeli?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.bonusWagerMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, bonusWagerMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="0 (Çevrimsiz)"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.casinoWagering)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Ürün Çevrimi — Casino</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Otomatik çekim onayında casino bahisleri için ayrı çarpan.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.casinoWagering ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, casinoWagering: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.sportWagering)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Ürün Çevrimi — Spor</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Otomatik çekim onayında spor bahisleri için ayrı çarpan.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.sportWagering ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, sportWagering: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.minSportOdds)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Spor Kuponu Şartı (Min Oran)</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Otomatik çekim onayında en az bu orana sahip bir kupon aranır.</p>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editValue?.minSportOdds ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minSportOdds: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.maxPayoutMult)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Kazanç Çarpanı (Max)</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonusun max kaç katı çekilebilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxPayoutMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxPayoutMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="10 (Örn)"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.maxPayoutFixed)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Sabit Max Kazanç</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Çekilebilecek maksimum net tutar.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxPayoutFixed ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxPayoutFixed: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Advanced Deposit Limits */}
                                                <div className={bolumSinifi([editValue?.minDepositAmount, editValue?.maxDepositAmount, editValue?.perDayLimit, editValue?.perWeekLimit, editValue?.allowedProviders, editValue?.consecutiveLossDeposits, editValue?.balanceBelow, editValue?.startTime, editValue?.endTime])}>
                                                    <h4 className="text-[10px] font-semibold text-purple-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" />
                                                        Gelişmiş Yatırım Limitleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                                        <div className={alanSinifi(editValue?.minDepositAmount)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Min Yatırım (Aralık)</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Yatırım tutarı en az kaç olmalı?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.minDepositAmount ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minDepositAmount: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Alt sınır"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.maxDepositAmount)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Max Yatırım (Aralık)</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Yatırım tutarı en fazla kaç olmalı?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxDepositAmount ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxDepositAmount: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Üst sınır"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.perDayLimit)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Günlük Kullanım</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bir günde kaç kez alınabilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.perDayLimit ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, perDayLimit: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.perWeekLimit)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Haftalık Kullanım</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bir haftada kaç kez alınabilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.perWeekLimit ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, perWeekLimit: Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.allowedProviders, 'md:col-span-2')}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">İzin Verilen Sağlayıcılar</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Virgülle ayırın. Boş bırakılırsa tüm sağlayıcılar geçerlidir. Ör: Pragmatic Play, Evolution</p>
                                                            <input
                                                                type="text"
                                                                value={(editValue?.allowedProviders ?? []).join(', ')}
                                                                onChange={(e) => setEditValue({
                                                                    ...editValue,
                                                                    allowedProviders: e.target.value
                                                                        .split(',')
                                                                        .map((p) => p.trim())
                                                                        .filter(Boolean),
                                                                })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                placeholder="Pragmatic Play"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Additional Logic Switches */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <h4 className="text-[10px] font-semibold text-purple-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" />
                                                        Ekstra Kontrol Switchleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        <ToggleField
                                                            label="İlk Yatırım Bonusu"
                                                            description="Yalnızca oyuncunun ilk yatırımında verilir; sonraki yatırımlarda geçerli değildir."
                                                            value={editValue?.isFirstDepositBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, isFirstDepositBonus: v })}
                                                        />
                                                    </div>
                                                </div>


                                                {/* Section: Talep Anı Koşulları */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <h4 className="text-[10px] font-semibold text-purple-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" />
                                                        Talep Anı Koşulları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className={alanSinifi(editValue?.consecutiveLossDeposits)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Aynı Gün Ardışık Kayıp Yatırımı</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Kaç yatırımın aynı gün kaybedilmiş olması gerektiği. Boş bırakılırsa kontrol edilmez.</p>
                                                            <input type="number" placeholder="Örn: 3"
                                                                value={editValue?.consecutiveLossDeposits ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, consecutiveLossDeposits: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                        </div>
                                                        <div className={alanSinifi(editValue?.balanceBelow)}>
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Bakiye Üst Sınırı (₺)</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Talep anında bakiye bu tutarın altında olmalı. Kayıp bonuslarında tipik değer 10.</p>
                                                            <input type="number" placeholder="Örn: 10"
                                                                value={editValue?.balanceBelow ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, balanceBelow: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all outline-none font-bold backdrop-blur-xl" />
                                                        </div>
                                                        <ToggleField
                                                            label="Açık Bahis Olmamalı"
                                                            description="Talep anında sonuçlanmamış kuponu veya süren casino turu varsa bonus verilmez."
                                                            value={editValue?.noOpenBets}
                                                            onChange={(v) => setEditValue({ ...editValue, noOpenBets: v })}
                                                        />
                                                    </div>
                                                </div>


                                                {/* Section: Time & Category Constraints */}
                                                <div className="space-y-4 pt-4 border-t border-white/5">
                                                    <h4 className="text-[10px] font-semibold text-purple-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" />
                                                        Zaman & Kategori Kısıtlamaları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-3">
                                                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Aktif Günler</label>
                                                            <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">Bonusun hangi günlerde talep edilebileceğini seçin.</p>
                                                            <div className="grid grid-cols-4 gap-8">
                                                                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, idx) => {
                                                                    const dayKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][idx];
                                                                    const isActive = editValue?.activeDays?.includes(dayKey);
                                                                    return (
                                                                        <button
                                                                            key={day}
                                                                            onClick={() => {
                                                                                const current = editValue?.activeDays || [];
                                                                                const next = current.includes(dayKey)
                                                                                    ? current.filter(d => d !== dayKey)
                                                                                    : [...current, dayKey];
                                                                                setEditValue({ ...editValue, activeDays: next });
                                                                            }}
                                                                            className={cn(
                                                                                "h-10 rounded-3xl text-[10px] font-semibold transition-all border backdrop-blur-xl",
                                                                                isActive ? "bg-[color:var(--panel-accent,#0a84ff)]/20 text-purple-300 border-[color:var(--panel-accent,#0a84ff)]/30" : "bg-white/[0.02] text-slate-500 border-white/5"
                                                                            )}
                                                                        >
                                                                            {day}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-8">
                                                            <div className={alanSinifi(editValue?.startTime)}>
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Başlangıç Saati</label>
                                                                <input
                                                                    type="time"
                                                                    value={editValue?.startTime ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, startTime: e.target.value })}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                />
                                                            </div>
                                                            <div className={alanSinifi(editValue?.endTime)}>
                                                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Bitiş Saati</label>
                                                                <input
                                                                    type="time"
                                                                    value={editValue?.endTime ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, endTime: e.target.value })}
                                                                    className="w-full h-12 bg-white/[0.02] border border-white/[0.05] rounded-3xl px-4 text-xs text-white focus:border-[color:var(--panel-accent,#0a84ff)] transition-all font-bold backdrop-blur-xl"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>


                                            {activeTab === 'id' && (
                                                <div className="space-y-6">
                                                    <LynonCampaignEditor campaignId={Number(key)} />
                                                    <PromoContentEditor
                                                        externalId={Number(key)}
                                                        promoTitle={getPromoTitleForRuleKey(key) ?? undefined}
                                                    />
                                                </div>
                                            )}                                        </motion.div>
                                    ) : (
                                        <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-4 flex-1">
                                                {/*
                                                  * Baslik once kuralin KENDI adini gosterir. Onceden yalnizca
                                                  * Lynon kampanya katalogundan isim araniyordu; nakit
                                                  * bonuslarin kampanyasi olmadigi icin adsiz kaliyorlardi.
                                                  */}
                                                <div className="space-y-1">
                                                    <span className="text-lg font-semibold text-white tracking-tight">
                                                        {spec.title?.trim() || getPromoTitleForRuleKey(key) || key}
                                                    </span>
                                                    <p className="text-[11px] font-semibold text-emerald-300">
                                                        {spec.title?.trim() && getPromoTitleForRuleKey(key) && getPromoTitleForRuleKey(key) !== spec.title.trim()
                                                            ? `${key} · ${getPromoTitleForRuleKey(key)}`
                                                            : key}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-8">
                                                    {spec.type && (
                                                        <div className="space-y-1 p-8 rounded-3xl bg-[color:var(--panel-accent,#0a84ff)]/5 border border-[color:var(--panel-accent,#0a84ff)]/10 backdrop-blur-xl">
                                                            <p className="text-[9px] font-semibold text-purple-300/70 uppercase">Bonus Tipi</p>
                                                            <p className="text-sm font-semibold text-purple-300">
                                                                {spec.type === 'partner' ? `Partner #${spec.partnerBonusId}` : 'Nakit'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {spec.amountType && (
                                                        <div className="space-y-1 p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-xl">
                                                            <p className="text-[9px] font-semibold text-emerald-500/70 uppercase">Tutar Ayarı</p>
                                                            <p className="text-sm font-semibold text-emerald-400">
                                                                {spec.amountType === 'fixed' ? `${spec.fixedAmount}₺ Sabit` :
                                                                 spec.amountType === 'percentage' ? `%${spec.percentageAmount}` :
                                                                 spec.amountType === 'full' ? 'Tam Yatırım' :
                                                                 spec.amountType === 'tieredRange' ? 'Baremli Yatırım Aralığı' :
                                                                 spec.amountType === 'tieredPercentage' ? 'Yüzdeli Barem Aralığı' :
                                                                 spec.amountType === 'dailySequencePercentage' ? `Günlük Sıra Kademesi (${(spec.dailySequencePercents ?? []).length})` :
                                                                 spec.amountType === 'averageOfLastDeposits' ? `Son ${spec.averageDepositCount ?? 3} Yatırım Ortalaması` : 'Baremli'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1 p-8 rounded-3xl bg-white/10 border border-white/[0.05] backdrop-blur-xl">
                                                        <p className="text-[9px] font-semibold text-slate-400 uppercase">Kontroller</p>
                                                        <div className="flex gap-1.5 mt-1">
                                                            {spec.checkPendingWithdrawal && <div className="w-2 h-2 rounded-full bg-rose-500" title="Çekim Kontrolü" />}
                                                            {spec.checkLastTransactionIsDeposit && <div className="w-2 h-2 rounded-full bg-amber-500" title="Son İşlem" />}
                                                            {spec.checkSingleInvestmentUsage && <div className="w-2 h-2 rounded-full bg-emerald-500" title="Tekil Yatırım" />}
                                                            {spec.isAutoCharge && <div className="w-2 h-2 rounded-full bg-[color:var(--panel-accent,#0a84ff)]" title="Oto Ekleme" />}
                                                        </div>
                                                    </div>
                                                    {spec.maxKpiLimit && <StatItem label="Max KPI" value={spec.maxKpiLimit} unit="TRY" color="rose-400" />}
                                                    {spec.maxBalanceToClaim && <StatItem label="Max Bakiye" value={spec.maxBalanceToClaim} unit="TRY" color="amber-400" />}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => {
                                                        const linked = promos.find((promo) => String(promo?.PartnerBonusId ?? '') === String(key));
                                                        setEditKey(key);
                                                        setEditValue({ ...spec, partnerBonusId: spec.partnerBonusId ?? (linked?.PartnerBonusId != null ? String(linked.PartnerBonusId) : undefined) });
                                                    }}
                                                    className="h-12 w-12 flex items-center justify-center rounded-full bg-[color:var(--panel-accent,#0a84ff)]/10 border border-[color:var(--panel-accent,#0a84ff)]/20 text-purple-300 hover:bg-[color:var(--panel-accent,#0a84ff)] hover:text-white transition-all shadow-lg"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                {/* Gizlenmis kampanyada silme yerine geri getirme sunulur. */}
                                                {(config?.HIDDEN_PROMO_IDS ?? []).some((id) => String(id) === String(key)) ? (
                                                    <button
                                                        onClick={() => handleUnhideRule(key)}
                                                        className="h-12 rounded-full border border-amber-300/30 bg-amber-400/10 px-5 text-[10px] font-bold uppercase tracking-widest text-amber-200 transition-all hover:bg-amber-400/20"
                                                        title="Listeye geri getir"
                                                    >
                                                        Geri getir
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDeleteRule(key, spec)}
                                                        className="h-12 w-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 border border-white/5 text-slate-400 hover:text-white transition-all shadow-lg"
                                                        title="Sil"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <Card className="flex items-center gap-3 border-white/5 bg-white/[0.02] p-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 size={18} />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-white">Analiz motoru aktif</p>
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">Senkronizasyon başarılı.</p>
                        </div>
                    </Card>
                    <BonusBlacklistPanel />
                    <Card className="p-8 border-white/5 bg-white/[0.02] shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-[color:var(--panel-accent,#0a84ff)] to-transparent opacity-20" />
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-10 w-10 rounded-full bg-[color:var(--panel-accent,#0a84ff)]/10 flex items-center justify-center text-purple-300 border border-[color:var(--panel-accent,#0a84ff)]/20">
                                <Info size={18} />
                            </div>
                            <h4 className="text-xs font-semibold text-white uppercase tracking-widest">Sistem Rehberi</h4>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">🎯 TEMEL MANTIK</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">ID Bazlı Mod</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Promosyonu BetConstruct üzerindeki unik ID'si ile eşleştirir. En güvenli yöntemdir.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Başlık Bazlı Mod</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Gelen bonus başlığını normalize ederek eşleştirir. Dönemsel kampanyalar için uygundur.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">⚙️ OTOMASYON</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Otomatik Ekleme</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Bu aktifse, analiz motoru onayı verir vermez bonus platforma (BC) direkt eklenir.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Baremli Tutar</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Yatırım tutarına göre kademeli bir bonus verilmesini sağlar. (Örn: 100-500₺ → 50₺ Bonus)</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">🛡️ KRİTİK KONTROLLER</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-purple-300 mb-1">Single ID Takibi</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Aynı yatırım fişinin (Deposit ID) birden fazla bonus için kullanılmasını engeller.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-purple-300 mb-1">Only New Player</h6>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Sadece sisteme yeni kayıt olmuş ve hiç işlemi olmayan 'saf' üyelerin taleplerini karşılar.</p>
                                    </div>
                                </div>
                            </section>

                            <div className="p-8 rounded-3xl bg-amber-500/5 border border-amber-500/10 backdrop-blur-xl">
                                <div className="flex gap-3">
                                    <AlertCircle className="text-amber-500 shrink-0" size={16} />
                                    <p className="text-[10px] font-bold text-amber-500/80 leading-relaxed italic">Değişikliklerin sunucuda aktif hale gelmesi yaklaşık 3 saniye sürer.</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatItem({ label, value, unit, color }: any) {
    if (value === undefined || value === null) return null;
    return (
        <div className="space-y-1 px-4 py-2 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={cn("text-sm font-semibold", color || "text-slate-200")}>
                {value} <span className="text-[10px] text-slate-400 font-bold uppercase">{unit}</span>
            </p>
        </div>
    );
}

function ToggleField({ label, description, value, onChange }: { label: string; description?: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
    return (
        <div className="group space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:border-[color:var(--panel-accent,#0a84ff)]/20 transition-all duration-500 hover:shadow-2xl hover:shadow-[color:var(--panel-accent,#0a84ff)]/5 backdrop-blur-xl">
            <div className="min-h-[48px]">
                <p className="text-[10px] font-semibold text-slate-400 group-hover:text-white uppercase tracking-[0.1em] transition-colors">{label}</p>
                {description && <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed line-clamp-2">{description}</p>}
            </div>
            <div className="flex p-1.5 bg-black/60 rounded-3xl border border-white/[0.05] shadow-inner backdrop-blur-xl">
                {[
                    { val: true, label: 'EVET', color: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' },
                    { val: false, label: 'HAYIR', color: 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]' },
                    { val: undefined, label: 'KAPALI', color: 'bg-white/10 text-slate-400 border border-white/5' }
                ].map((opt) => (
                    <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => onChange(opt.val)}
                        className={cn(
                            "relative flex-1 h-10 rounded-xl text-[10px] font-semibold tracking-widest transition-all duration-500 flex items-center justify-center",
                            value === opt.val ? opt.color : "text-slate-500 hover:text-slate-400"
                        )}
                    >
                        {value === opt.val && (
                            <motion.div
                                layoutId={`toggle-glow-${label}`}
                                className={cn("absolute inset-0 rounded-xl z-0", opt.color.split(' ')[0])}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function LynonCampaignEditor({ campaignId }: { campaignId: number }) {
    const queryClient = useQueryClient();
    const validId = Number.isInteger(campaignId) && campaignId > 0;
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['lynon-campaign-details', campaignId],
        enabled: validId,
        queryFn: async () => {
            const response = await fetch(`/api/admin/bonus/lynon-campaign/${campaignId}`, { credentials: 'include' });
            const json = await response.json();
            if (!response.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Lynon kampanyası okunamadı');
            return json;
        },
        staleTime: 60 * 1000,
    });
    const [campaignJson, setCampaignJson] = useState('{}');
    const [bonusesJson, setBonusesJson] = useState('[]');

    useEffect(() => {
        if (!data?.Data) return;
        setCampaignJson(JSON.stringify(data.Data.campaign ?? {}, null, 2));
        setBonusesJson(JSON.stringify(data.Data.bonuses ?? [], null, 2));
    }, [data]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const campaign = JSON.parse(campaignJson);
            const bonuses = JSON.parse(bonusesJson);
            if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) throw new Error('Kampanya JSON nesne olmalı.');
            if (!Array.isArray(bonuses)) throw new Error('Bonus blokları JSON dizisi olmalı.');
            const response = await fetch(`/api/admin/bonus/lynon-campaign/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ campaign, bonuses }),
            });
            const json = await response.json();
            if (!response.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Lynon parametreleri kaydedilemedi');
            return json;
        },
        onSuccess: () => {
            toast.success('Lynon kampanya ve bonus blokları güncellendi');
            queryClient.invalidateQueries({ queryKey: ['lynon-campaign-details', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['partner-bonuses-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-partner-bonuses'] });
        },
        onError: (mutationError: Error) => toast.error(mutationError.message),
    });

    if (!validId) return null;
    return (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.035] p-8 md:p-8 space-y-6 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Lynon Bonus Engine V2</p>
                    <h4 className="mt-1 text-xl font-semibold text-white">Kampanya ve tüm blok parametreleri</h4>
                    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">Tarih, para birimi, atama limiti, şablon, assignmentLimits ve blocksConfiguration değerleri doğrudan Lynon’a kaydedilir. ID ve site alanları değiştirilemez.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => refetch()} disabled={isLoading} className="h-11 rounded-3xl border border-white/[0.05] bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50 backdrop-blur-xl">
                        <RefreshCw size={15} className={cn('mr-2 inline', isLoading && 'animate-spin')} /> YENİLE
                    </button>
                    <Button type="button" variant="primary" onClick={() => saveMutation.mutate()} disabled={isLoading || saveMutation.isPending} className="h-11 rounded-3xl border-none bg-amber-400 px-6 text-xs font-semibold text-[#050609] hover:bg-[color:var(--panel-warning,#ff9f0a)] backdrop-blur-xl">
                        {saveMutation.isPending ? 'LYNON’A KAYDEDİLİYOR...' : 'LYNON’A KAYDET'}
                    </Button>
                </div>
            </div>
            {error && <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-xs font-bold text-rose-300 backdrop-blur-xl">{(error as Error).message}</div>}
            {isLoading ? (
                <div className="py-10 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Parametreler yükleniyor...</div>
            ) : (
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                    <label className="space-y-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kampanya parametreleri</span>
                        <textarea value={campaignJson} onChange={(event) => setCampaignJson(event.target.value)} spellCheck={false} className="min-h-[360px] w-full rounded-3xl border border-white/[0.05] bg-black/50 p-8 font-mono text-[11px] leading-relaxed text-amber-100 outline-none focus:border-amber-400/50 backdrop-blur-xl" />
                    </label>
                    <label className="space-y-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Bonuslar ve blocksConfiguration</span>
                        <textarea value={bonusesJson} onChange={(event) => setBonusesJson(event.target.value)} spellCheck={false} className="min-h-[360px] w-full rounded-3xl border border-white/[0.05] bg-black/50 p-8 font-mono text-[11px] leading-relaxed text-emerald-100 outline-none focus:border-emerald-400/50 backdrop-blur-xl" />
                    </label>
                </div>
            )}
            <div className="text-[10px] font-bold text-slate-500">Şablon: {(data?.Data?.templates ?? []).map((template: any) => `#${template.id ?? template.templateId} ${template.systemName ?? template.name ?? ''}`).join(' · ') || 'Şablon bilgisi yok'} · Blok kataloğu: {data?.Data?.blocks?.length ?? 0}</div>
        </div>
    );
}

function PromoContentEditor({ externalId, promoTitle }: { externalId: number; promoTitle?: string }) {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['admin-promo-overrides'],
        queryFn: async () => {
            const res = await fetch('/api/admin/promos/overrides', { credentials: 'include' });
            return res.json();
        },
        staleTime: 30 * 1000,
    });

    const current = ((data as any)?.data?.byExternalId ?? {})?.[String(externalId)] ?? {};

    const [title, setTitle] = useState<string>('');
    const [image, setImage] = useState<string>('');
    const [detailHtml, setDetailHtml] = useState<string>('');
    /** Lobideki sira. Bos birakilirsa katalog sirasi korunur. */
    const [sortOrder, setSortOrder] = useState<string>('');
    /** Yuklenen gorselin gercek olcusu; oran uyarisi icin. */
    const [olcu, setOlcu] = useState<{ w: number; h: number } | null>(null);

    useEffect(() => {
        setTitle(String(current?.title ?? ''));
        setImage(String(current?.image ?? ''));
        setDetailHtml(String(current?.detailHtml ?? ''));
        setSortOrder(current?.sortOrder == null ? '' : String(current.sortOrder));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalId, (current as any)?.title, (current as any)?.image, (current as any)?.detailHtml, (current as any)?.sortOrder]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                externalId,
                override: {
                    title: title.trim() || undefined,
                    image: image.trim() || undefined,
                    detailHtml: detailHtml.trim() || undefined,
                    // Bos birakilirsa alan hic gonderilmez: "0" ile "sira
                    // verilmemis" ayni sey degil.
                    sortOrder: sortOrder.trim() === '' ? undefined : Number(sortOrder),
                }
            };
            const res = await fetch('/api/admin/promos/overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-promo-overrides'] });
            queryClient.invalidateQueries({ queryKey: ['promos-list'] });
            toast.success('Bonus içeriği güncellendi');
        },
        onError: () => toast.error('Bonus içeriği kaydedilemedi'),
    });

    const clearMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/promos/overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ externalId, override: null }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-promo-overrides'] });
            queryClient.invalidateQueries({ queryKey: ['promos-list'] });
            toast.success('Override sıfırlandı');
        },
        onError: () => toast.error('Sıfırlama başarısız'),
    });

    return (
        <div className="space-y-6 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] relative overflow-hidden group backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 via-[color:var(--panel-accent,#0a84ff)]/50 to-transparent opacity-30" />

            <div className="flex flex-col md:flex-row items-start justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-emerald-400">
                        <Sparkles size={24} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Platform Override Content</p>
                        <h4 className="text-xl font-semibold text-white">Bonus Görünümü & İçerik</h4>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        disabled={clearMutation.isPending || isLoading}
                        onClick={() => clearMutation.mutate()}
                        className="px-6 py-2.5 rounded-xl bg-white/5 text-[10px] font-semibold text-slate-400 hover:text-white transition-all uppercase tracking-widest"
                    >
                        SIFIRLA
                    </button>
                    <Button
                        variant="primary"
                        disabled={saveMutation.isPending || isLoading}
                        onClick={() => saveMutation.mutate()}
                        className="h-11 px-10 rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-[#050609] font-semibold text-[10px] border-none shadow-lg shadow-emerald-500/10 uppercase tracking-widest backdrop-blur-xl"
                    >
                        {saveMutation.isPending ? 'KAYDEDİLİYOR...' : 'İÇERİĞİ GÜNCELLE'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Alternatif Başlık</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/[0.05] rounded-3xl px-5 text-sm text-white focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all outline-none font-bold backdrop-blur-xl"
                            placeholder="Orijinal başlığı gizlemek için doldurun..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Preview Görsel URL</label>
                        <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">
                            Lobide <strong className="text-slate-400">692 × 336</strong> oranında gösterilir. Farklı oranda bir görsel kırpılır.
                        </p>
                        {/*
                          Yuklenen gorselin GERCEK olcusu okunup orana gore
                          uyariliyor. Yonetici "kirpildi" durumunu canlida
                          degil, burada gormeli.
                        */}
                        {olcu && Math.abs(olcu.w / olcu.h - 692 / 336) > 0.06 && (
                            <p className="mb-1 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-300">
                                Görsel {olcu.w}×{olcu.h} ({(olcu.w / olcu.h).toFixed(2)}:1) — lobi oranı 2.06:1.
                                Kenarlardan kırpılacak. 692×336 önerilir.
                            </p>
                        )}
                        <input
                            value={image}
                            onChange={(e) => setImage(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/[0.05] rounded-3xl px-5 text-sm text-white focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all outline-none font-bold backdrop-blur-xl"
                            placeholder="https://..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Lobideki sıra</label>
                        <p className="text-[10px] text-slate-500 font-medium pl-1 mb-1">
                            Küçük olan önce görünür. Boş bırakılırsa sıra verilmiş bonusların ardından, katalog sırasıyla dizilir.
                        </p>
                        <input
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/[0.05] rounded-3xl px-5 text-sm text-white focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all outline-none font-bold backdrop-blur-xl"
                            placeholder="Örn: 1"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">Açıklama (HTML)</label>
                        <textarea
                            value={detailHtml}
                            onChange={(e) => setDetailHtml(e.target.value)}
                            className="w-full min-h-[220px] bg-black/40 border border-white/[0.05] rounded-3xl px-5 py-4 text-sm text-slate-200 focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all outline-none leading-relaxed backdrop-blur-xl"
                            placeholder="HTML formatında bonus detaylarını girin..."
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block pl-1">CANLI ÖNİZLEME</label>
                    <div className="relative rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 h-full min-h-[400px] overflow-hidden group/preview backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--panel-accent,#0a84ff)]/5 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity" />

                        {/*
                          ORAN LOBIYLE AYNI: 692/336.
                          Onizleme `aspect-video` (16:9) idi; lobi ise 2.06
                          oraninda cizdiriyor. Yonetici burada gordugu
                          kadraji ALMIYORDU — gorselin alti ve ustu lobide
                          kirpiliyor, fark ancak canlida ortaya cikiyordu.
                        */}
                        {image?.trim() ? (
                            <img
                                src={image.trim()}
                                alt=""
                                onLoad={(e) => {
                                    const el = e.currentTarget;
                                    setOlcu({ w: el.naturalWidth, h: el.naturalHeight });
                                }}
                                onError={() => setOlcu(null)}
                                className="w-full aspect-[692/336] object-cover rounded-3xl border border-white/[0.05] shadow-2xl mb-6 backdrop-blur-xl"
                            />
                        ) : (
                            <div className="w-full aspect-[692/336] rounded-3xl bg-black/40 border border-dashed border-white/[0.05] flex flex-col items-center justify-center text-slate-500 gap-3 mb-6 backdrop-blur-xl">
                                <Sparkles size={32} className="opacity-20" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Görsel Bekleniyor</span>
                                <span className="text-[10px] font-medium text-slate-600">Önerilen: 692 × 336</span>
                            </div>
                        )}

                        <div className="space-y-4 relative z-10">
                            <h5 className="text-xl font-semibold text-white">{title?.trim() || promoTitle || 'Bonus Başlığı'}</h5>
                            <div className="h-px w-12 bg-[color:var(--panel-accent,#0a84ff)]" />
                            {detailHtml?.trim() ? (
                                <div className="text-sm text-slate-400 font-medium leading-relaxed max-h-[150px] overflow-auto custom-scrollbar pr-2" dangerouslySetInnerHTML={{ __html: detailHtml }} />
                            ) : (
                                <p className="text-sm text-slate-500 italic font-medium">İçerik detayı henüz girilmemiş...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
