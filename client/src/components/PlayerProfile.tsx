import { useState, useRef, useEffect } from 'react';
import { DURUM_NOKTASI, durumAyrintisi, islemDurumu } from '../lib/islemDurumu';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { dashboardApi, adminApi } from '../api/client';
import { formatNumber, formatDateTimeDisplay, formatDateTimeWithSeconds } from '../lib/format';
import { TRANSACTION_TYPES } from '../lib/constants';
import { getPlayerCategoryFromListRow } from '../lib/playerCategories';
import type { ClientBonusItem } from '../types/dashboard';
import {
    User,
    TrendingUp,
    TrendingDown,
    Wallet,
    Trophy,
    Gamepad2,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    Calendar,
    DollarSign,
    ChevronLeft,
    MessageSquare,
    Clock,
    UserCheck,
    Gift,
    FileText,
    LayoutDashboard,
    History,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronsLeft,
    BarChart3,
    Coins,
    Users,
    Layers,
    Check,
    RotateCcw,
    ChevronDown,
    Globe
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { PlayerSportsBets } from './PlayerSportsBets';
import { PlayerCasinoBets } from './PlayerCasinoBets';
import { AdvancedCharts } from './PlayerAdvancedCharts';
import { NetworkMap } from './NetworkMap';
import { AIPlayerInsight } from './AIPlayerInsight';

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200, 500];
const LYNON_TRANSACTION_TYPES = [
    { id: 'payment.deposit', name: 'Yatırım' },
    { id: 'payment.withdrawal', name: 'Çekim' },
    { id: 'correction.crediting', name: 'Bakiye Düzeltmesi - Alacak' },
    { id: 'correction.debiting', name: 'Bakiye Düzeltmesi - Borç' },
];

/** YYYY-MM-DD → "DD-MM-YY - HH:mm:ss" (GetClientTransactionsV1 format) */
function ymdToLocalDateTime(ymd: string, isEnd: boolean): string {
    const [y, m, d] = ymd.split('-');
    if (!d) return ymd;
    const time = isEnd ? '23:59:59' : '00:00:00';
    return `${d}-${m}-${y.slice(-2)} - ${time}`;
}

/** Yerel tarih → YYYY-MM-DD (toISOString UTC verdiği için Bugün yanlış gün çıkmasın diye) */
function toLocalYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD + N gün → YYYY-MM-DD (gösterim: bitiş ertesi gün 00:00) */
function ymdAddDays(ymd: string, days: number): string {
    const d = new Date(ymd + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return toLocalYMD(d);
}

/** YYYY-MM-DD → DD-MM-YY (UTC parse hatası olmasın diye string ile) */
function ymdToDDMMYY(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    return d && m && y ? `${d}-${m}-${y.slice(-2)}` : ymd;
}

/** GetClientBonuses CreatedLocal → timestamp (yerel). Desteklenen: "DD-MM-YY HH:mm", "DD-MM-YY - HH:mm:ss", "YYYY-MM-DD...". */
function parseBonusDateLocal(str: string | null | undefined): number | null {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    // ISO: 2026-02-18 veya 2026-02-18T21:06:00
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const [, y, m, d] = iso;
        const rest = trimmed.slice(iso[0].length).match(/(\d{1,2}):?(\d{1,2})?:?(\d{1,2})?/);
        const h = rest?.[1] ? parseInt(rest[1], 10) : 0;
        const min = rest?.[2] ? parseInt(rest[2], 10) : 0;
        const sec = rest?.[3] ? parseInt(rest[3], 10) : 0;
        const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10), h, min, sec);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    }
    // DD-MM-YY veya DD-MM-YY HH:mm veya DD-MM-YY - HH:mm:ss
    const match = trimmed.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})\s*(?:-\s*)?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
    if (!match) return null;
    const [, d, m, y, h, min, sec] = match;
    const year = y!.length === 2 ? 2000 + parseInt(y!, 10) : parseInt(y!, 10);
    const month = parseInt(m!, 10) - 1;
    const day = parseInt(d!, 10);
    const hour = h ? parseInt(h, 10) : 0;
    const minute = min ? parseInt(min, 10) : 0;
    const second = sec ? parseInt(sec, 10) : 0;
    const date = new Date(year, month, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function defaultTransactionDateRange(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start: toLocalYMD(start), end: toLocalYMD(end) };
}

type ProfileTab = 'overview' | 'notes' | 'bonuses' | 'transactions' | 'sports-bets' | 'casino-bets' | 'detailed-report' | 'ip-addresses';

export function PlayerProfile() {
    const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [jumpPage, setJumpPage] = useState('1');
    const defaultRange = defaultTransactionDateRange();
    const [txFilterStart, setTxFilterStart] = useState(defaultRange.start);
    const [txFilterEnd, setTxFilterEnd] = useState(defaultRange.end);
    const [txFilterTypeIds, setTxFilterTypeIds] = useState<Array<number | string>>([]);
    const [appliedTxStart, setAppliedTxStart] = useState(defaultRange.start);
    const [appliedTxEnd, setAppliedTxEnd] = useState(defaultRange.end);
    const [appliedTxTypeIds, setAppliedTxTypeIds] = useState<Array<number | string>>([]);
    const [txTypeDropdownOpen, setTxTypeDropdownOpen] = useState(false);
    const txTypeDropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Detailed Report: Bugün = yerel gün (21-02-26 / 21-02-26), Dün = 20-02-26 / 20-02-26
    const todayYMD = toLocalYMD(new Date());
    const yesterdayYMD = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalYMD(d); })();
    const [detStart, setDetStart] = useState(todayYMD);
    const [detEnd, setDetEnd] = useState(todayYMD);
    const [isDetDateSetByKpi, setIsDetDateSetByKpi] = useState(false);

    // Bonus Filtering (varsayılan son 7 gün; boş value date input’u bozabiliyor)
    const defaultBonusEnd = toLocalYMD(new Date());
    const defaultBonusStart = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return toLocalYMD(d);
    })();
    const [bonusStart, setBonusStart] = useState<string>(defaultBonusStart);
    const [bonusEnd, setBonusEnd] = useState<string>(defaultBonusEnd);
    const [appliedBonusStart, setAppliedBonusStart] = useState<string>('');
    const [appliedBonusEnd, setAppliedBonusEnd] = useState<string>('');
    const [isBonusDateOpen, setIsBonusDateOpen] = useState(false);
    const bonusDropdownRef = useRef<HTMLDivElement>(null);
    const [selectedQuickBonus, setSelectedQuickBonus] = useState('');
    const [quickBonusAmount, setQuickBonusAmount] = useState('');
    const [isQuickCharging, setIsQuickCharging] = useState(false);
    const [correctionType, setCorrectionType] = useState<'crediting' | 'debiting'>('crediting');
    const [correctionAmount, setCorrectionAmount] = useState('');
    const [correctionNote, setCorrectionNote] = useState('');
    const [isCorrectingBalance, setIsCorrectingBalance] = useState(false);

    const pathParts = location.pathname.split('/').filter(Boolean);
    const id = pathParts[1];
    const login = pathParts[2];

    const clientId = Number(id);

    useEffect(() => {
        const onOutside = (e: MouseEvent) => {
            if (txTypeDropdownRef.current && !txTypeDropdownRef.current.contains(e.target as Node)) setTxTypeDropdownOpen(false);
        };
        if (txTypeDropdownOpen) {
            document.addEventListener('click', onOutside);
            return () => document.removeEventListener('click', onOutside);
        }
    }, [txTypeDropdownOpen]);

    // Queries
    const { data, isLoading: isKpiLoading, error: kpiError } = useQuery({
        queryKey: ['client-kpi', clientId],
        queryFn: () => dashboardApi.clientKpi(clientId),
        staleTime: 60 * 1000,
        enabled: !!clientId,
    });
    const kpi = data?.Data;


    const { data: notesData, isLoading: isNotesLoading } = useQuery({
        queryKey: ['client-notes', clientId],
        queryFn: () => dashboardApi.clientNotes(clientId),
        staleTime: 60 * 1000,
        enabled: !!clientId && activeTab === 'notes',
    });

    const { data: bonusesData, isLoading: isBonusesLoading } = useQuery({
        queryKey: ['client-bonuses', clientId, appliedBonusStart, appliedBonusEnd],
        queryFn: () => dashboardApi.clientBonuses(clientId, {
            FromDateLocal: appliedBonusStart ? ymdToLocalDateTime(appliedBonusStart, false) : null,
            ToDateLocal: appliedBonusEnd ? ymdToLocalDateTime(appliedBonusEnd, true) : null
        }),
        staleTime: 60 * 1000,
        enabled: !!clientId && activeTab === 'bonuses',
    });

    const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery({
        queryKey: ['client-profile-transactions', clientId, page, rowsPerPage, appliedTxStart, appliedTxEnd, appliedTxTypeIds],
        queryFn: () => dashboardApi.clientProfileTransactions({
            ClientId: clientId,
            StartTimeLocal: ymdToLocalDateTime(appliedTxStart, false),
            EndTimeLocal: ymdToLocalDateTime(appliedTxEnd, true),
            DocumentTypeIds: appliedTxTypeIds.length > 0 ? appliedTxTypeIds : undefined,
            SkeepRows: (page - 1) * rowsPerPage,
            MaxRows: rowsPerPage
        }),
        staleTime: 60 * 1000,
        enabled: !!clientId && activeTab === 'transactions',
    });

    // Bu oyuncunun geçmişinde fiilen görülen Lynon işlem tiplerini keşfetmek için
    // tip filtresi uygulanmadan geniş bir örnek çekiyoruz; sabit listede olmayan
    // tipler (ör. yeni bir ödeme yöntemi) filtreye otomatik eklensin diye.
    const { data: txTypesSampleData } = useQuery({
        queryKey: ['client-profile-transaction-types', clientId, appliedTxStart, appliedTxEnd],
        queryFn: () => dashboardApi.clientProfileTransactions({
            ClientId: clientId,
            StartTimeLocal: ymdToLocalDateTime(appliedTxStart, false),
            EndTimeLocal: ymdToLocalDateTime(appliedTxEnd, true),
            SkeepRows: 0,
            MaxRows: 500
        }),
        staleTime: 5 * 60 * 1000,
        enabled: !!clientId && activeTab === 'transactions',
    });

    const { data: clientDetailData } = useQuery({
        queryKey: ['client-detail', clientId],
        queryFn: () => dashboardApi.clients({ Id: clientId, MaxRows: 1, SkeepRows: 0 }),
        staleTime: 60 * 1000,
        enabled: !!clientId && (activeTab === 'ip-addresses' || activeTab === 'overview'),
    });
    const clientDetail = clientDetailData?.Data?.Objects?.[0];
    const loginIP = (kpi?.LastLoginIp ?? clientDetail?.LastLoginIp ?? clientDetail?.RegistrationIp ?? '') || null;

    const { data: clientsByIPData } = useQuery({
        queryKey: ['clients-by-ip', loginIP],
        queryFn: () => dashboardApi.clientsByIP({ LoginIP: loginIP!, ClientId: clientId, MaxRows: 50, SkeepRows: 0 }),
        staleTime: 60 * 1000,
        enabled: !!clientId && !!loginIP,
    });

    const { data: partnerBonusesData } = useQuery({
        queryKey: ['partner-bonuses'],
        queryFn: () => dashboardApi.partnerBonusList({}),
        staleTime: 5 * 60 * 1000,
        enabled: !!clientId && activeTab === 'bonuses',
    });

    const { data: detailedReportData, isLoading: isDetailedReportLoading } = useQuery({
        queryKey: ['client-detailed-report', clientId, detStart, detEnd],
        queryFn: () => dashboardApi.clientDetailedReport({
            ClientId: clientId,
            StartTimeLocal: ymdToLocalDateTime(detStart, false),
            EndTimeLocal: ymdToLocalDateTime(detEnd, true)
        }),
        staleTime: 60 * 1000,
        enabled: !!clientId && activeTab === 'detailed-report',
    });
    const partnerBonusRoot = partnerBonusesData?.Data ?? partnerBonusesData?.Result;
    const partnerBonusesRaw = Array.isArray(partnerBonusRoot) ? partnerBonusRoot : (Array.isArray(partnerBonusRoot?.Objects) ? partnerBonusRoot.Objects : []);
    const partnerBonusesList = partnerBonusesRaw.filter((bonus: any) => {
        const partnerBonusId = Number(bonus?.PartnerBonusId ?? bonus?.CampaignId);
        return Number.isInteger(partnerBonusId) && partnerBonusId > 0 && bonus?.IsAssignable !== false;
    });

    const handleQuickCharge = async () => {
        if (!selectedQuickBonus) {
            alert('Lütfen bir bonus seçin');
            return;
        }
        setIsQuickCharging(true);
        try {
            const selectedDefinition = partnerBonusesList.find((bonus: any) =>
                String(bonus?.PartnerBonusId ?? bonus?.CampaignId) === selectedQuickBonus
            );
            const playerLogin = String(kpi?.Login ?? login ?? '').trim();
            if (!playerLogin) throw new Error('Oyuncu kullanıcı adı doğrulanamadı');

            // Hızlı tanımlama da önce aynı fail-closed uygunluk kontrolünden geçer.
            // Başarılı kontrol, sunucuda kısa ömürlü tek kullanımlık yükleme izni üretir.
            const eligibility = await adminApi.checkPlayer(playerLogin, {
                bonusId: Number(selectedQuickBonus),
                bonusName: selectedDefinition?.Name,
            });
            const specificCheck = eligibility?.Data?.specificBonusCheck;
            if (eligibility.HasError || !specificCheck?.overallOk) {
                const reasons = (specificCheck?.items ?? [])
                    .filter((item: any) => !item.ok)
                    .map((item: any) => item.reason || item.label)
                    .filter(Boolean);
                throw new Error(reasons.join(' | ') || eligibility.AlertMessage || 'Bonus uygunluk şartları sağlanmadı');
            }

            const res = await adminApi.chargeBonus({
                ClientId: clientId,
                BonusId: Number(selectedQuickBonus),
                Amount: Number(quickBonusAmount) || 0,
                AssignmentValues: Number(quickBonusAmount) > 0 ? { BonusMoneyAmount: Number(quickBonusAmount) } : {},
            });
            if (res.HasError) throw new Error(res.AlertMessage || 'Bonus eklenemedi');
            alert('Bonus başarıyla tanımlandı');
            setQuickBonusAmount('');
            setSelectedQuickBonus('');
        } catch (err: any) {
            alert('Hata: ' + err.message);
        } finally {
            setIsQuickCharging(false);
        }
    };

    const handleBalanceCorrection = async () => {
        const amount = Number(correctionAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Pozitif bir düzeltme tutarı girin');
            return;
        }
        const directionLabel = correctionType === 'crediting' ? 'Düzeltme Üst (crediting)' : 'Düzeltme Alt (debiting)';
        if (!window.confirm(`${directionLabel}: ${amount} TRY işlemini onaylıyor musunuz?`)) return;

        setIsCorrectingBalance(true);
        try {
            const res = await adminApi.manualAdjustment({
                ClientId: clientId,
                Amount: amount,
                CorrectionType: correctionType,
                Info: correctionNote.trim() || `${directionLabel} / Bugs panel`,
            });
            if (res.HasError) throw new Error(res.AlertMessage || 'Bakiye düzeltmesi işlenemedi');
            alert(res.AlertMessage || 'Bakiye düzeltmesi işlendi');
            setCorrectionAmount('');
            setCorrectionNote('');
        } catch (err: any) {
            alert('Hata: ' + err.message);
        } finally {
            setIsCorrectingBalance(false);
        }
    };

    // Auto-set detailed report start date to last deposit time
    useEffect(() => {
        if (activeTab === 'detailed-report' && data?.Data?.LastDepositTimeLocal && !isDetDateSetByKpi) {
            const lastDepISO = data.Data.LastDepositTimeLocal.slice(0, 10);
            setDetStart(lastDepISO);
            setIsDetDateSetByKpi(true);
        }
    }, [activeTab, data, isDetDateSetByKpi]);

    const handleDetailedReportQuickDate = (type: 'today' | 'yesterday') => {
        const d = new Date();
        if (type === 'yesterday') d.setDate(d.getDate() - 1);
        const ymd = toLocalYMD(d);
        setDetStart(ymd);
        setDetEnd(ymd);
    };

   const notes = notesData?.Data || [];
    const allBonuses = [...(bonusesData?.Data || [])];
    const bonuses = (() => {
        const sorted = allBonuses.sort((a: any, b: any) =>
            (b.CreatedLocal || '').localeCompare(a.CreatedLocal || '')
        );
        if (!appliedBonusStart || !appliedBonusEnd) return sorted;
        const startT = new Date(appliedBonusStart + 'T00:00:00').getTime();
        const endT = new Date(appliedBonusEnd + 'T23:59:59').getTime();
        return sorted.filter((b: any) => {
            const t = parseBonusDateLocal(b.CreatedLocal) ?? parseBonusDateLocal(b.AcceptanceDateLocal);
            if (t == null) return false;
            return t >= startT && t <= endT;
        });
    })();
    const transactions = transactionsData?.Data?.Objects || [];
    const totalCount = transactionsData?.Data?.Count || 0;
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const isLynonTransactions = transactionsData?.Data?.Provider === 'lynon';
    const transactionTypeOptions: Array<{ id: number | string; name: string }> = isLynonTransactions
        ? (() => {
            // Sunucu kanonik listeyi (tüm Lynon operationType'ları) döner; yoksa sabit
            // çekirdek listeye düşülür. Üstüne bu oyuncuda fiilen görülen, listede
            // olmayan tipler (ör. yeni bir ödeme yöntemi) eklenir.
            const canonical = (transactionsData?.Data?.TransactionTypes
                || txTypesSampleData?.Data?.TransactionTypes
                || LYNON_TRANSACTION_TYPES) as Array<{ id: string; name: string }>;
            const discovered = (txTypesSampleData?.Data?.Objects || []) as Array<{ TypeCode?: string; TypeName?: string }>;
            const merged = new Map(canonical.map((t) => [t.id, t.name]));
            discovered.forEach((row) => {
                if (row.TypeCode && !merged.has(row.TypeCode)) {
                    merged.set(row.TypeCode, row.TypeName || row.TypeCode);
                }
            });
            return Array.from(merged, ([id, name]) => ({ id, name }));
        })()
        : TRANSACTION_TYPES.filter((type) => type.id !== '').map((type) => ({ id: Number(type.id), name: type.name }));

    const handlePageChange = (newPage: number) => {
        const validatedPage = Math.max(1, Math.min(totalPages, newPage));
        setPage(validatedPage);
        setJumpPage(validatedPage.toString());
    };

    const handleJumpPage = (e: React.FormEvent) => {
        e.preventDefault();
        const num = parseInt(jumpPage);
        if (!isNaN(num)) {
            handlePageChange(num);
        }
    };

    const handleApplyTransactionFilters = () => {
        setAppliedTxStart(txFilterStart);
        setAppliedTxEnd(txFilterEnd);
        setAppliedTxTypeIds([...txFilterTypeIds]);
        setPage(1);
        setJumpPage('1');
    };

    const handleResetTransactionFilters = () => {
        const def = defaultTransactionDateRange();
        setTxFilterStart(def.start);
        setTxFilterEnd(def.end);
        setTxFilterTypeIds([]);
        setAppliedTxStart(def.start);
        setAppliedTxEnd(def.end);
        setAppliedTxTypeIds([]);
        setPage(1);
        setJumpPage('1');
    };

    const toggleTxTypeId = (typeId: number | string) => {
        setTxFilterTypeIds((prev) =>
            prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
        );
    };

    const handleQuickDateRange = (type: 'today' | 'yesterday' | 'last-7' | 'last-30' | 'this-month') => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'last-7':
                start.setDate(now.getDate() - 7);
                break;
            case 'last-30':
                start.setDate(now.getDate() - 30);
                break;
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
        }

        const sStr = toLocalYMD(start);
        const eStr = toLocalYMD(end);

        setTxFilterStart(sStr);
        setTxFilterEnd(eStr);
        setAppliedTxStart(sStr);
        setAppliedTxEnd(eStr);
        setPage(1);
    };

    const handleBonusQuickDateRange = (type: 'all' | 'today' | 'yesterday' | 'last-7' | 'last-30' | 'this-month') => {
        const now = new Date();
        let start: Date | null = new Date();
        let end: Date | null = new Date();

        switch (type) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'last-7':
                start.setDate(now.getDate() - 7);
                break;
            case 'last-30':
                start.setDate(now.getDate() - 30);
                break;
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'all':
                start = null;
                end = null;
                break;
        }

        const sStr = start ? toLocalYMD(start) : '';
        const eStr = end ? toLocalYMD(end) : '';

        setBonusStart(sStr);
        setBonusEnd(eStr);
        setAppliedBonusStart(sStr);
        setAppliedBonusEnd(eStr);
        setIsBonusDateOpen(false);
    };


    const getStatusIcon = (type: number) => {
        switch (type) {
            case 1: return <CheckCircle2 className="text-emerald-400" size={16} />;
            case 3: return <XCircle className="text-rose-400" size={16} />;
            default: return <AlertCircle className="text-amber-400" size={16} />;
        }
    };

    const getStatusText = (type: number) => {
        switch (type) {
            case 1: return 'Tamamlandı';
            case 3: return 'İptal Edildi';
            case 2: return 'Aktif';
            default: return 'Beklemede';
        }
    };

    const getBonusTypeLabel = (type: number | undefined) => {
        if (type == null) return '—';
        switch (type) {
            case 5: return 'FreeSpin';
            case 1: return 'WageringBonus';
            case 2: return 'NoWager';
            case 3: return 'FreeBet';
            case 4: return 'Cashback';
            default: return `Tip ${type}`;
        }
    };

    if (!id) return (
        <div className="flex items-center justify-center py-20 text-[color:var(--panel-muted,#8a919c)] font-bold uppercase tracking-widest">
            Lütfen bir oyuncu seçin
        </div>
    );

    const tabEntries: { value: ProfileTab; icon: typeof LayoutDashboard; label: string }[] = [
        { value: 'overview', icon: LayoutDashboard, label: 'Genel Bakış' },
        { value: 'notes', icon: FileText, label: 'Notlar' },
        { value: 'bonuses', icon: Gift, label: 'Bonuslar' },
        { value: 'transactions', icon: History, label: 'İşlemler' },
        { value: 'sports-bets', icon: Trophy, label: 'Spor Bahisleri' },
        { value: 'casino-bets', icon: Gamepad2, label: 'Casino Bahisleri' },
        { value: 'detailed-report', icon: BarChart3, label: 'Detaylı Rapor' },
        { value: 'ip-addresses', icon: Globe, label: 'IP Adresleri' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="pb-6"
        >
            {/* Header */}
            <Card className="mb-3 p-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-400/20 bg-[color:var(--panel-accent,#0a84ff)]/[0.1] text-blue-300">
                            <User size={20} />
                        </div>
                        <div className="min-w-0 text-left">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <h2 className="text-lg font-bold tracking-[-0.025em] text-white sm:text-xl">
                                    {kpi?.Name || kpi?.Login || login || 'Oyuncu'}
                                </h2>
                                {(() => {
                                    const category = getPlayerCategoryFromListRow({ Id: Number(id) }, (kpi as Record<string, unknown> | undefined) ?? undefined);
                                    return (
                                        <span
                                            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1"
                                            style={{
                                                backgroundColor: category.colorBg,
                                                color: category.colorText,
                                                boxShadow: `inset 0 0 0 1px ${category.colorText}4d`,
                                            }}
                                        >
                                            {category.label}
                                        </span>
                                    );
                                })()}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-wider">Müşteri ID: #{id}</p>
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={() => navigate(-1)}
                        className="gap-2 shrink-0"
                    >
                        <ChevronLeft size={18} />
                        Geri Dön
                    </Button>
                </div>
            </Card>

            {/* Tab Navigation - Radix Tabs */}
            <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="mb-3">
                <Tabs.List className={cn(
                    'inline-flex flex-wrap gap-0.5 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-0.5'
                )}>
                    {tabEntries.map(({ value, icon: Icon, label }) => (
                        <Tabs.Trigger
                            key={value}
                            value={value}
                            className={cn(
                                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[9px] font-bold uppercase tracking-[0.06em] transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                                'data-[state=active]:bg-[color:var(--panel-accent,#0a84ff)] data-[state=active]:text-white',
                                'data-[state=inactive]:text-[color:var(--panel-muted,#8a919c)] data-[state=inactive]:hover:bg-white/5 data-[state=inactive]:hover:text-[color:var(--panel-text-dim,#c8cdd5)]'
                            )}
                        >
                            <Icon size={16} className="shrink-0" />
                            {label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                {/* Content Area */}
                {isKpiLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6">
                        <div className="relative">
                            <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-8 w-8 animate-ping rounded-full bg-blue-500/20" />
                            </div>
                        </div>
                        <p className="text-sm font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.4em] animate-pulse">Veriler Çekiliyor...</p>
                    </div>
                ) : kpiError || !kpi ? (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 py-32 text-center text-rose-400">
                        <p className="text-lg font-semibold uppercase tracking-widest">Veri Hatası</p>
                        <p className="mt-2 text-sm opacity-70">Bu oyuncuya ait veriler şu an BetConstruct servisinden alınamıyor.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="outline-none"
                        >
                            {activeTab === 'overview' && (
                                <div className="mt-3 space-y-4">
                                    {<AIPlayerInsight data={kpi} ipData={clientsByIPData} />}
                                    <section>
                                        <div className="mb-3 flex items-center gap-3 text-left">
                                            <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-500">Mali Performans</h3>
                                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <StatBox
                                                title="Net Kar/Zarar"
                                                value={`${formatNumber(kpi.DepositAmount - kpi.WithdrawalAmount)} TRY`}
                                                icon={DollarSign}
                                                colorClass={(kpi.DepositAmount - kpi.WithdrawalAmount) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
                                            />
                                            <StatBox
                                                title="Hesap Bakiyesi"
                                                value={`${formatNumber(kpi.Balance ?? clientDetail?.Balance ?? 0)} TRY`}
                                                icon={Wallet}
                                                colorClass="bg-blue-500/10 text-blue-400"
                                            />
                                            <StatBox
                                                title="Toplam Yatırım"
                                                value={`${formatNumber(kpi.DepositAmount)} TRY`}
                                                subValue={`${kpi.DepositCount} İşlem`}
                                                icon={ArrowUpRight}
                                                colorClass="bg-emerald-500/10 text-emerald-400"
                                            />
                                            <StatBox
                                                title="Toplam Çekim"
                                                value={`${formatNumber(kpi.WithdrawalAmount)} TRY`}
                                                subValue={`${kpi.WithdrawalCount} İşlem`}
                                                icon={ArrowDownRight}
                                                colorClass="bg-rose-500/10 text-rose-400"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                                            <StatBox
                                                title="Oyun Net Kar/Zarar"
                                                value={`${formatNumber(kpi.GamingProfitAndLose)} TRY`}
                                                icon={TrendingUp}
                                                colorClass={kpi.GamingProfitAndLose >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
                                            />
                                            <StatBox
                                                title="Son Yatırım Tutarı"
                                                value={`${formatNumber(kpi.LastDepositAmount)} TRY`}
                                                icon={ArrowUpRight}
                                                colorClass="bg-emerald-500/10 text-emerald-400"
                                            />
                                            <StatBox
                                                title="Son Çekim Tutarı"
                                                value={`${formatNumber(kpi.LastWithdrawalAmount)} TRY`}
                                                icon={ArrowDownRight}
                                                colorClass="bg-rose-500/10 text-rose-400"
                                            />
                                            <StatBox
                                                title="Para Birimi"
                                                value={kpi.CurrencyId ?? '—'}
                                                icon={Wallet}
                                                colorClass="bg-[rgba(242,244,248,0.08)] text-[color:var(--panel-muted,#8a919c)]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                                            <StatBox
                                                title="TotalDeposit"
                                                value={`${formatNumber(kpi.TotalDeposit)} TRY`}
                                                icon={ArrowUpRight}
                                                colorClass="bg-emerald-500/10 text-emerald-400"
                                            />
                                            <StatBox
                                                title="TotalWithdrawal"
                                                value={`${formatNumber(kpi.TotalWithdrawal)} TRY`}
                                                icon={ArrowDownRight}
                                                colorClass="bg-rose-500/10 text-rose-400"
                                            />
                                        </div>
                                    </section>

                                    <AdvancedCharts data={kpi} />

                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <Card className="p-4">
                                            <CardHeader className="flex flex-row p-0 pb-3 items-center justify-between">
                                                <CardTitle className="text-blue-400">Sportbook Analizi</CardTitle>
                                                <TrendingUp className="text-blue-400 shrink-0" size={20} />
                                            </CardHeader>
                                            <CardContent className="space-y-2 p-0">
                                                <DetailRow label="Toplam Bahis Tutarı" value={formatNumber(kpi.TotalSportStakes)} unit="TRY" icon={Activity} color="indigo" />
                                                <DetailRow label="Ödenen Kazançlar" value={formatNumber(kpi.TotalSportWinnings)} unit="TRY" icon={Trophy} color="emerald" />
                                                <DetailRow
                                                    label="Verimlilik Oranı"
                                                    value={`${formatNumber(kpi.SportProfitness)}%`}
                                                    icon={TrendingUp}
                                                    color={kpi.SportProfitness >= 0 ? "emerald" : "rose"}
                                                />
                                                <DetailRow label="Toplam Bahis Sayısı" value={formatNumber(kpi.TotalSportBets)} icon={Activity} color="indigo" />
                                                <DetailRow label="Açık Bahis Sayısı" value={formatNumber(kpi.TotalUnsettledBets)} icon={Clock} color="indigo" />
                                                <DetailRow label="Açık Bahis Tutarı" value={formatNumber(kpi.TotalUnsettledStakes)} unit="TRY" icon={Activity} color="indigo" />
                                                <DetailRow label="Bonus Bahis Tutarı" value={formatNumber(kpi.TotalSportBonusStakes)} unit="TRY" icon={Gift} color="purple" />
                                                <DetailRow label="Bonus Kazançları" value={formatNumber(kpi.TotalSportBonusWinings)} unit="TRY" icon={Trophy} color="emerald" />
                                            </CardContent>
                                        </Card>

                                        <Card className="p-4">
                                            <CardHeader className="flex flex-row p-0 pb-3 items-center justify-between">
                                                <CardTitle className="text-blue-400">Casino Analizi</CardTitle>
                                                <Gamepad2 className="text-blue-400 shrink-0" size={20} />
                                            </CardHeader>
                                            <CardContent className="space-y-2 p-0">
                                                <DetailRow label="Toplam Bahis Miktarı" value={formatNumber(kpi.TotalCasinoStakes)} unit="TRY" icon={Activity} color="purple" />
                                                <DetailRow label="Casino Kazançları" value={formatNumber(kpi.TotalCasinoWinnings)} unit="TRY" icon={Trophy} color="emerald" />
                                                <DetailRow
                                                    label="Verimlilik Oranı"
                                                    value={`${formatNumber(kpi.CasinoProfitness)}%`}
                                                    icon={TrendingDown}
                                                    color={kpi.CasinoProfitness >= 0 ? "emerald" : "rose"}
                                                />
                                                <DetailRow label="Casino Bonus Bahis" value={formatNumber(kpi.TotalCasinoBonusStakes)} unit="TRY" icon={Gift} color="purple" />
                                                <DetailRow label="Casino Bonus Kazanç" value={formatNumber(kpi.TotalCasinoBonusWinings)} unit="TRY" icon={Trophy} color="emerald" />
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card className="p-4">
                                        <CardTitle className="mb-4 text-left text-[color:var(--panel-muted,#8a919c)]">Hesap Özeti (tüm KPI alanları)</CardTitle>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                                            <InfoTile label="KPI Id" value={String(kpi.Id ?? '—')} icon={User} />
                                            <InfoTile label="Oyuncu Id" value={String(kpi.ClientId ?? '—')} icon={User} />
                                            <InfoTile label="Kullanıcı Adı" value={kpi.Login ?? login ?? '—'} icon={User} />
                                            <InfoTile label="Ad Soyad" value={kpi.Name ?? '—'} icon={User} />
                                            <InfoTile label="Para Birimi" value={kpi.CurrencyId ?? '—'} icon={Wallet} />
                                            <InfoTile label="Doğrulama" value={kpi.IsVerified ? 'ONAYLI HESAP' : 'ONAYSIZ'} icon={ShieldCheck} isSuccess={kpi.IsVerified} />
                                            <InfoTile label="Gerçek Bakiye" value={`${formatNumber(kpi.Balance ?? 0)} TRY`} icon={Wallet} />
                                            <InfoTile label="Bonus Bakiye" value={`${formatNumber(kpi.BonusBalance ?? 0)} TRY`} icon={Gift} />
                                            <InfoTile label="Toplam Bakiye" value={`${formatNumber(kpi.TotalBalance ?? kpi.Balance ?? 0)} TRY`} icon={Layers} />
                                            <InfoTile label="Toplam Yatırım" value={`${formatNumber(kpi.DepositAmount)} TRY / ${formatNumber(kpi.DepositCount)} işlem`} icon={ArrowUpRight} />
                                            <InfoTile label="Son Yatırım" value={`${formatNumber(kpi.LastDepositAmount)} TRY`} icon={ArrowUpRight} />
                                            <InfoTile label="Son Yatırım Tarihi" value={kpi.LastDepositTimeLocal ? formatDateTimeDisplay(kpi.LastDepositTimeLocal) : '—'} icon={Calendar} />
                                            <InfoTile label="Toplam Çekim" value={`${formatNumber(kpi.WithdrawalAmount)} TRY / ${formatNumber(kpi.WithdrawalCount)} işlem`} icon={ArrowDownRight} />
                                            <InfoTile label="Son Çekim" value={`${formatNumber(kpi.LastWithdrawalAmount)} TRY`} icon={ArrowDownRight} />
                                            <InfoTile label="Son Çekim Tarihi" value={kpi.LastWithdrawalTimeLocal ? formatDateTimeDisplay(kpi.LastWithdrawalTimeLocal) : '—'} icon={Calendar} />
                                            <InfoTile label="Toplam Bahis" value={`${formatNumber(kpi.TotalBetAmount ?? (kpi.TotalCasinoStakes + kpi.TotalSportStakes))} TRY`} icon={Activity} />
                                            <InfoTile label="Toplam Kazanç" value={`${formatNumber(kpi.TotalWinAmount ?? (kpi.TotalCasinoWinnings + kpi.TotalSportWinnings))} TRY`} icon={Trophy} />
                                            <InfoTile label="GGR" value={`${formatNumber(kpi.GamingProfitAndLose)} TRY`} icon={TrendingUp} />
                                            <InfoTile label="Casino Bahis" value={`${formatNumber(kpi.TotalCasinoStakes)} TRY`} icon={Gamepad2} />
                                            <InfoTile label="Casino Kazanç" value={`${formatNumber(kpi.TotalCasinoWinnings)} TRY`} icon={Trophy} />
                                            <InfoTile label="Casino Bonus Bahis" value={`${formatNumber(kpi.TotalCasinoBonusStakes)} TRY`} icon={Gift} />
                                            <InfoTile label="Casino Bonus Kazanç" value={`${formatNumber(kpi.TotalCasinoBonusWinings)} TRY`} icon={Gift} />
                                            <InfoTile label="Casino GGR" value={`${formatNumber(kpi.CasinoProfitness)} TRY`} icon={TrendingDown} />
                                            <InfoTile label="Spor Bahis" value={`${formatNumber(kpi.TotalSportStakes)} TRY`} icon={Activity} />
                                            <InfoTile label="Spor Kazanç" value={`${formatNumber(kpi.TotalSportWinnings)} TRY`} icon={Trophy} />
                                            <InfoTile label="Spor Bonus Bahis" value={`${formatNumber(kpi.TotalSportBonusStakes)} TRY`} icon={Gift} />
                                            <InfoTile label="Spor Bonus Kazanç" value={`${formatNumber(kpi.TotalSportBonusWinings)} TRY`} icon={Gift} />
                                            <InfoTile label="Spor GGR" value={`${formatNumber(kpi.SportProfitness)} TRY`} icon={TrendingUp} />
                                            <InfoTile label="Freespin Kazancı" value={`${formatNumber(kpi.FreeSpinWin ?? 0)} TRY`} icon={Gamepad2} />
                                            <InfoTile label="Bonus Ödemesi" value={`${formatNumber(kpi.BonusPayout ?? 0)} TRY`} icon={Gift} />
                                            <InfoTile label="Cashback" value={`${formatNumber(kpi.CashbackBonus ?? 0)} TRY`} icon={Coins} />
                                            <InfoTile label="Kayıt Tarihi" value={kpi.RegistrationDate ? formatDateTimeDisplay(kpi.RegistrationDate) : '—'} icon={Calendar} />
                                            <InfoTile label="Son Giriş" value={kpi.LastLoginDate ? formatDateTimeDisplay(kpi.LastLoginDate) : '—'} icon={Clock} />
                                            <InfoTile label="Son Giriş IP" value={kpi.LastLoginIp ?? '—'} icon={Globe} />
                                            <InfoTile label="BTag" value={kpi.BTag ?? '—'} icon={Users} />
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {activeTab === 'sports-bets' && (
                                <motion.div
                                    key="sports-bets"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <PlayerSportsBets clientId={Number(id)} />
                                </motion.div>
                            )}

                            {activeTab === 'casino-bets' && (
                                <motion.div
                                    key="casino-bets"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <PlayerCasinoBets clientId={Number(id)} />
                                </motion.div>
                            )}



                            {activeTab === 'notes' && (
                                <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 backdrop-blur-md text-left">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400">Oyuncu Notları</h3>
                                        <MessageSquare className="text-amber-400" size={20} />
                                    </div>

                                    {isNotesLoading ? (
                                        <div className="py-20 text-center animate-pulse text-[color:var(--panel-muted,#8a919c)] font-bold uppercase text-[10px] tracking-widest">Notlar Yükleniyor...</div>
                                    ) : notes.length === 0 ? (
                                        <div className="py-20 text-center text-[color:var(--panel-muted,#8a919c)] italic text-sm">Henüz bir not eklenmemiş.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {notes.map((note: any) => (
                                                <div key={note.Id} className="rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-6 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] transition-all relative group">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
                                                                <UserCheck size={18} />
                                                            </div>
                                                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">{note.CreatedBy}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[color:var(--panel-muted,#8a919c)]">
                                                            <Clock size={14} />
                                                            <span className="text-[10px] font-bold">{formatDateTimeDisplay(note.CreatedLocal)}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-base text-[color:var(--panel-text-dim,#c8cdd5)] leading-relaxed font-medium">{note.Note}</p>
                                                    {note.TypeName && (
                                                        <span className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-semibold bg-white/5 px-3 py-1 rounded text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ring-1 ring-white/5">
                                                            {note.TypeName}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {activeTab === 'bonuses' && (
                                <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 backdrop-blur-md text-left">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-400">Bonus Hareketleri</h3>
                                        </div>

                                        <div className="flex flex-col md:flex-row items-end gap-3 p-4 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ml-1">Hızlı Bonus Tanımla</label>
                                                    <select
                                                        value={selectedQuickBonus}
                                                        onChange={(e) => setSelectedQuickBonus(e.target.value)}
                                                        className="w-full h-10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
                                                    >
                                                        <option value="">{partnerBonusesList.length > 0 ? 'Bonus Seçin...' : 'Bonus Bulunamadı veya Yükleniyor...'}</option>
                                                        {partnerBonusesList.map((b: any) => (
                                                            <option key={b.PartnerBonusId ?? b.CampaignId} value={b.PartnerBonusId ?? b.CampaignId}>{b.Name} (Partner #{b.PartnerBonusId ?? b.CampaignId})</option>
                                                        ))}
                                                    </select>
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ml-1">Miktar</label>
                                                <input
                                                    type="number"
                                                    value={quickBonusAmount}
                                                    onChange={(e) => setQuickBonusAmount(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full h-10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                                                />
                                            </div>
                                            <Button
                                                variant="primary"
                                                onClick={handleQuickCharge}
                                                disabled={isQuickCharging || !selectedQuickBonus}
                                                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                            >
                                                {isQuickCharging ? <RotateCcw className="animate-spin" size={14} /> : 'TANIMLA'}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 md:grid-cols-[180px_140px_1fr_auto] md:items-end">
                                            <div className="space-y-2">
                                                <label className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Correction Type</label>
                                                <select
                                                    value={correctionType}
                                                    onChange={(e) => setCorrectionType(e.target.value as 'crediting' | 'debiting')}
                                                    className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] px-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/40"
                                                >
                                                    <option value="crediting">Düzeltme Üst · Crediting</option>
                                                    <option value="debiting">Düzeltme Alt · Debiting</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Amount (TRY)</label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={correctionAmount}
                                                    onChange={(e) => setCorrectionAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] px-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/40"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">İşlem Notu</label>
                                                <input
                                                    type="text"
                                                    maxLength={50}
                                                    value={correctionNote}
                                                    onChange={(e) => setCorrectionNote(e.target.value)}
                                                    placeholder="Zorunlu denetim notu (maks. 50)"
                                                    className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] px-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/40"
                                                />
                                            </div>
                                            <Button
                                                variant="primary"
                                                onClick={handleBalanceCorrection}
                                                disabled={isCorrectingBalance || !correctionAmount}
                                                className={cn(
                                                    'h-10 px-5 text-[10px] font-semibold uppercase tracking-widest text-white disabled:opacity-50',
                                                    correctionType === 'crediting' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                                                )}
                                            >
                                                {isCorrectingBalance ? <RotateCcw className="animate-spin" size={14} /> : correctionType === 'crediting' ? 'BAKİYE EKLE' : 'BAKİYE DÜŞ' }
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Mevcut Bonus Kayıtları</h4>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="h-7 px-3 text-[10px] font-semibold uppercase tracking-widest gap-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                    onClick={() => navigate('/bonus-talep', { state: { login: kpi?.Login } })}
                                                >
                                                    <Gift size={14} />
                                                    Bonus Ekle
                                                </Button>
                                            </div>

                                            <div className="relative" ref={bonusDropdownRef}>
                                                <div className="flex flex-col gap-1.5 min-w-[280px]">
                                                    <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ml-1">Tarih Seçici</label>
                                                    <div className="flex">
                                                        <div className="flex h-10 flex-1 items-center gap-2 rounded-l-xl bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-4 text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">
                                                            {appliedBonusStart && appliedBonusEnd
                                                                ? `${ymdToDDMMYY(appliedBonusStart)} 00:00 / ${ymdToDDMMYY(ymdAddDays(appliedBonusEnd, 1))} 00:00`
                                                                : 'Tüm Zamanlar'
                                                            }
                                                        </div>
                                                        <button
                                                            onClick={() => setIsBonusDateOpen(!isBonusDateOpen)}
                                                            className="flex h-10 w-12 items-center justify-center rounded-r-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all border-l-0"
                                                        >
                                                            <Calendar size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isBonusDateOpen && (
                                                    <div
                                                        className="absolute right-0 top-full z-[100] mt-2 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-2 shadow-2xl animate-in fade-in slide-in-from-top-2"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {[
                                                            { id: 'all', label: 'Tümü' },
                                                            { id: 'today', label: 'Bugün' },
                                                            { id: 'yesterday', label: 'Dün' },
                                                            { id: 'last-7', label: 'Son 7 Gün' },
                                                            { id: 'last-30', label: 'Son 30 Gün' },
                                                            { id: 'this-month', label: 'Bu Ay' },
                                                        ].map((btn) => (
                                                            <button
                                                                key={btn.id}
                                                                onClick={() => handleBonusQuickDateRange(btn.id as any)}
                                                                className={`w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${(btn.id === 'all' && !appliedBonusStart) ||
                                                                    (btn.id === 'today' && appliedBonusStart === todayYMD && appliedBonusEnd === todayYMD)
                                                                    ? 'bg-cyan-500 text-white'
                                                                    : 'text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-white'
                                                                    }`}
                                                            >
                                                                {btn.label}
                                                            </button>
                                                        ))}
                                                        <div className="mt-2 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] pt-2 flex flex-col gap-2 p-2">
                                                            <span className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Özel Tarih</span>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <input
                                                                    type="date"
                                                                    value={bonusStart}
                                                                    onChange={(e) => setBonusStart(e.target.value)}
                                                                    min="2000-01-01"
                                                                    max={bonusEnd || defaultBonusEnd}
                                                                    className="bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg p-2 text-[10px] text-white outline-none focus:ring-2 focus:ring-cyan-500/40 [color-scheme:dark]"
                                                                />
                                                                <input
                                                                    type="date"
                                                                    value={bonusEnd}
                                                                    onChange={(e) => setBonusEnd(e.target.value)}
                                                                    min={bonusStart || defaultBonusStart}
                                                                    max={defaultBonusEnd}
                                                                    className="bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg p-2 text-[10px] text-white outline-none focus:ring-2 focus:ring-cyan-500/40 [color-scheme:dark]"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setAppliedBonusStart(bonusStart);
                                                                    setAppliedBonusEnd(bonusEnd);
                                                                    setIsBonusDateOpen(false);
                                                                }}
                                                                className="w-full py-2 bg-cyan-600 rounded-lg text-[10px] font-semibold text-white hover:bg-cyan-500 transition-all uppercase"
                                                            >
                                                                Uygula
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isBonusesLoading ? (
                                            <div className="py-24 text-center rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                <div className="inline-flex items-center gap-3 text-[color:var(--panel-muted,#8a919c)]">
                                                    <div className="h-6 w-6 rounded-full border-2 border-cyan-500/40 border-t-cyan-400 animate-spin" />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Bonuslar yükleniyor</span>
                                                </div>
                                            </div>
                                        ) : bonuses.length === 0 ? (
                                            <div className="py-24 text-center rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                <Gift className="mx-auto text-[color:var(--panel-faint,#5c6470)] mb-3" size={32} />
                                                <p className="text-sm text-[color:var(--panel-muted,#8a919c)] font-medium">Katılım sağlanan bir bonus bulunamadı.</p>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] overflow-hidden shadow-inner">
                                                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                    <table className="w-full text-left min-w-[1200px]">
                                                        <thead>
                                                            <tr className="bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] text-[10px] font-semibold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                                <th className="py-3.5 pl-5 pr-3 font-medium">ID</th>
                                                                <th className="py-3.5 px-3 font-medium">Bonus Adı</th>
                                                                <th className="py-3.5 px-3 font-medium">Oluşturulma</th>
                                                                <th className="py-3.5 px-3 font-medium">Tür</th>
                                                                <th className="py-3.5 px-3 font-medium">Konum</th>
                                                                <th className="py-3.5 px-3 font-medium">Birim</th>
                                                                <th className="py-3.5 px-3 font-medium text-right">Miktar</th>
                                                                <th className="py-3.5 px-3 font-medium text-right">Hesaplama</th>
                                                                <th className="py-3.5 px-3 font-medium text-right">Ödenen</th>
                                                                <th className="py-3.5 px-3 font-medium text-right">Dönüştürülen</th>
                                                                <th className="py-3.5 px-3 font-medium">Çevrim</th>
                                                                <th className="py-3.5 px-3 font-medium">Sonuç</th>
                                                                <th className="py-3.5 px-3 font-medium">Sonuç Tarihi</th>
                                                                <th className="py-3.5 px-3 font-medium">Kabul Tarihi</th>
                                                                <th className="py-3.5 px-3 font-medium">Başlangıç</th>
                                                                <th className="py-3.5 px-3 font-medium">Son Kullanım</th>
                                                                <th className="py-3.5 px-3 font-medium">İşlem Yapan</th>
                                                                <th className="py-3.5 pr-5 pl-3 font-medium">Durum</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {bonuses.map((bonus: ClientBonusItem, idx: number) => {
                                                                const isExpired = bonus.ClientBonusExpirationDateLocal && new Date(bonus.ClientBonusExpirationDateLocal).getTime() < Date.now();
                                                                const isNotCompleted = (bonus.ToWagerAmount ?? 0) > 0;
                                                                const showExpiredStatus = isExpired && isNotCompleted;
                                                                const konum = bonus.AcceptanceDateLocal && bonus.ResultType !== 3 ? 'Aktif' : '—';
                                                                const rowBg = idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]';
                                                                return (
                                                                    <tr key={bonus.Id} className={`group hover:bg-white/[0.04] transition-colors ${rowBg}`}>
                                                                        <td className="py-3.5 pl-5 pr-3 text-xs font-mono text-[color:var(--panel-muted,#8a919c)]">{bonus.Id}</td>
                                                                        <td className="py-3.5 px-3 max-w-[200px]">
                                                                            <p className="text-sm font-bold text-white truncate group-hover:text-cyan-300/90 transition-colors">{bonus.Name}</p>
                                                                            {(bonus.Description ?? '').trim() && <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] truncate mt-0.5">{bonus.Description}</p>}
                                                                            {bonus.IsTest && <span className="inline-block mt-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">Test</span>}
                                                                        </td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">{formatDateTimeWithSeconds(bonus.CreatedLocal)}</td>
                                                                        <td className="py-3.5 px-3"><span className="inline-flex rounded-md bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] px-2 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-dim,#c8cdd5)]">{getBonusTypeLabel(bonus.BonusType)}</span></td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)]">{konum}</td>
                                                                        <td className="py-3.5 px-3 text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">{bonus.ClientCurrency ?? 'TRY'}</td>
                                                                        <td className="py-3.5 px-3 text-sm font-bold text-emerald-400 tabular-nums text-right">{formatNumber(bonus.Amount ?? 0)}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] tabular-nums text-right">{formatNumber(bonus.RealAmount ?? 0)}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] tabular-nums text-right">{formatNumber(bonus.PaidAmount ?? 0)}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] tabular-nums text-right">{formatNumber(bonus.TotalPaidAmount ?? 0)}</td>
                                                                        <td className="py-3.5 px-3 text-[11px] text-[color:var(--panel-muted,#8a919c)]"><span className="text-[color:var(--panel-muted,#8a919c)]">Çevrilen</span> {formatNumber(bonus.WageredAmount ?? 0)} · <span className="text-[color:var(--panel-muted,#8a919c)]">Kalan</span> {formatNumber(bonus.ToWagerAmount ?? 0)}</td>
                                                                        <td className="py-3.5 px-3">
                                                                            {showExpiredStatus ? <span className="inline-flex rounded-full bg-[rgba(242,244,248,0.08)] px-2.5 py-0.5 text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)]">Süresi dolmuş</span> : <span className="inline-flex rounded-full bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] px-2.5 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-dim,#c8cdd5)]">{getStatusText(bonus.ResultType)}</span>}
                                                                        </td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">{bonus.ResultDateLocal ? formatDateTimeWithSeconds(bonus.ResultDateLocal) : '—'}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">{bonus.AcceptanceDateLocal ? formatDateTimeWithSeconds(bonus.AcceptanceDateLocal) : '—'}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">{bonus.StartDateLocal ? formatDateTimeDisplay(bonus.StartDateLocal) : '—'}</td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">
                                                                            {bonus.ClientBonusExpirationDateLocal ? formatDateTimeWithSeconds(bonus.ClientBonusExpirationDateLocal) : '—'}
                                                                            {isExpired && isNotCompleted && <span className="block text-[10px] text-rose-400/80 mt-0.5">süresi dolmuş</span>}
                                                                        </td>
                                                                        <td className="py-3.5 px-3 text-xs text-[color:var(--panel-muted,#8a919c)]">{bonus.CreatedByUserName ?? '—'}</td>
                                                                        <td className="py-3.5 pr-5 pl-3">
                                                                            <div className="flex items-center gap-2">
                                                                                {showExpiredStatus ? (
                                                                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(242,244,248,0.08)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-2.5 py-1.5 text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)]">
                                                                                        <Clock size={12} /> Süresi dolmuş
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-2.5 py-1.5 text-[10px] font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">
                                                                                        {getStatusIcon(bonus.ResultType)}
                                                                                        {getStatusText(bonus.ResultType)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {bonus.CanAccept && <span className="inline-block mt-1.5 text-[9px] font-medium text-emerald-400">Kabul edilebilir</span>}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {activeTab === 'transactions' && (
                                <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 backdrop-blur-md text-left">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-400">İşlem Hareketleri</h3>
                                            <History className="text-blue-400" size={20} />
                                        </div>
                                        <div className="flex items-center gap-3 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] px-4 py-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] ring-1 ring-white/5">
                                            <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">SATIR SAYISI:</span>
                                            <select
                                                value={rowsPerPage}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setRowsPerPage(val);
                                                    setPage(1);
                                                    setJumpPage('1');
                                                }}
                                                className="h-8 rounded-lg bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-2 text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] outline-none hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] transition-all focus:ring-1 focus:ring-blue-500/30"
                                            >
                                                {ROWS_PER_PAGE_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt} className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-8 flex flex-wrap items-end gap-6 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-6">
                                        <div className="flex flex-col gap-3">
                                            <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Hızlı Tarih Seçimi</span>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: 'today', label: 'Bugün' },
                                                    { id: 'yesterday', label: 'Dün' },
                                                    { id: 'last-7', label: 'Son 7 Gün' },
                                                    { id: 'last-30', label: 'Son 30 Gün' },
                                                    { id: 'this-month', label: 'Bu Ay' },
                                                ].map((btn) => (
                                                    <button
                                                        key={btn.id}
                                                        onClick={() => handleQuickDateRange(btn.id as any)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${(btn.id === 'today' && appliedTxStart === todayYMD && appliedTxEnd === todayYMD)
                                                            ? 'bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/20'
                                                            : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/10 hover:text-white'
                                                            }`}
                                                    >
                                                        {btn.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col gap-2">
                                                <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Özel Aralık</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="date"
                                                        value={txFilterStart}
                                                        onChange={(e) => setTxFilterStart(e.target.value)}
                                                        className="h-9 rounded-lg bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-3 text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] outline-none focus:ring-1 focus:ring-blue-500/30 [color-scheme:dark]"
                                                    />
                                                    <span className="text-[color:var(--panel-muted,#8a919c)]">/</span>
                                                    <input
                                                        type="date"
                                                        value={txFilterEnd}
                                                        onChange={(e) => setTxFilterEnd(e.target.value)}
                                                        className="h-9 rounded-lg bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-3 text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] outline-none focus:ring-1 focus:ring-blue-500/30 [color-scheme:dark]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative" ref={txTypeDropdownRef}>
                                            <span className="mr-2 text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Tür</span>
                                            <button
                                                type="button"
                                                onClick={() => setTxTypeDropdownOpen((o) => !o)}
                                                className="flex items-center gap-2 h-9 min-w-[200px] rounded-lg bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-3 text-left text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] transition-all"
                                            >
                                                {txFilterTypeIds.length === 0 ? 'Tümü' : `${txFilterTypeIds.length} tür seçili`}
                                                <ChevronDown size={14} className="ml-auto shrink-0" />
                                            </button>
                                            {txTypeDropdownOpen && (
                                                <div className="absolute left-0 top-full z-20 mt-1 max-h-[320px] w-[320px] overflow-y-auto rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] shadow-xl">
                                                    <div className="p-2">
                                                        {transactionTypeOptions.map((t) => {
                                                            const tid = t.id;
                                                            return (
                                                                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={txFilterTypeIds.includes(tid)}
                                                                        onChange={() => toggleTxTypeId(tid)}
                                                                        className="h-4 w-4 rounded border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                                                    />
                                                                    <span className="text-xs font-medium text-[color:var(--panel-text-dim,#c8cdd5)]">{t.name}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleResetTransactionFilters}
                                            className="gap-2"
                                        >
                                            <RotateCcw size={14} />
                                            Sıfırla
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleApplyTransactionFilters}
                                            className="gap-2"
                                        >
                                            <Check size={14} />
                                            Uygula
                                        </Button>
                                    </div>

                                    {isTransactionsLoading ? (
                                        <div className="py-20 text-center animate-pulse text-[color:var(--panel-muted,#8a919c)] font-bold uppercase text-[10px] tracking-widest">İşlemler Yükleniyor...</div>
                                    ) : transactions.length === 0 ? (
                                        <div className="py-20 text-center text-[color:var(--panel-muted,#8a919c)] italic text-sm">Henüz bir işlem hareketi bulunamadı.</div>
                                    ) : (
                                        (() => {
                                            // Çekim Talebi Reddedilmiştir'den hemen sonraki (listedeki alt satır = kronolojide önceki talep) Çekim Talebi = reddedilmiş talebin DocumentId'leri
                                            const rejectedWithdrawalDocIds = new Set<number>();
                                            for (let i = 0; i < transactions.length; i++) {
                                                const type = String((transactions[i] as any).DocumentTypeName ?? '');
                                                if (type.toLowerCase().includes('reddedilmiştir') && i < transactions.length - 1) {
                                                    const next = transactions[i + 1] as any;
                                                    const nextType = String(next?.DocumentTypeName ?? '');
                                                    if (nextType.includes('Çekim Talebi') && !nextType.toLowerCase().includes('reddedilmiştir') && next?.DocumentId != null) {
                                                        rejectedWithdrawalDocIds.add(Number(next.DocumentId));
                                                    }
                                                }
                                            }
                                            return (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--panel-muted,#8a919c)]">
                                                                <th className="pb-4 pl-4">İşlem Türü / Ref</th>
                                                                <th className="pb-4">Miktar</th>
                                                                <th className="pb-4">Bakiye</th>
                                                                <th className="pb-4">Tarih</th>
                                                                <th className="pb-4">İşlem Yapan</th>
                                                                <th className="pb-4 pr-4">Durum</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {transactions.map((tx: any) => (
                                                                <tr key={tx.DocumentId} className="group hover:bg-white/[0.02] transition-colors">
                                                                    <td className="py-6 pl-4">
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                                                    {tx.DocumentTypeName}
                                                                                </p>
                                                                                {tx.Game && (
                                                                                    <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase">
                                                                                        {tx.Game}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="mt-1 text-[10px] text-[color:var(--panel-muted,#8a919c)] font-bold uppercase tracking-tighter">
                                                                                #{tx.ReferenceNo ?? tx.DocumentId}
                                                                                {tx.BetId && <span className="ml-2 text-[color:var(--panel-faint,#5c6470)]">Bet ID: {tx.BetId}</span>}
                                                                            </p>
                                                                            {tx.Note && <p className="mt-1 text-[10px] text-[color:var(--panel-muted,#8a919c)] italic line-clamp-1 max-w-xs">{tx.Note}</p>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-6">
                                                                        <span className={`text-sm font-semibold ${tx.Operation === 2 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                            {tx.Operation === 2 ? '+' : '-'}{formatNumber(tx.Amount)} {tx.CurrencyId}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-6">
                                                                        <span className="text-sm font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">
                                                                            {tx.Balance == null ? '—' : formatNumber(tx.Balance)} {tx.Balance != null && <span className="text-[10px] opacity-50">{tx.CurrencyId}</span>}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-6">
                                                                        <span className="text-[11px] font-bold text-[color:var(--panel-muted,#8a919c)]">{formatDateTimeWithSeconds(tx.CreatedLocal)}</span>
                                                                    </td>
                                                                    <td className="py-6">
                                                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] bg-white/5 px-2 py-1 rounded-md">
                                                                            {tx.UserName}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-6 pr-4">
                                                                        {(() => {
                                                                            const durum = islemDurumu(tx);
                                                                            const label = durumAyrintisi(tx);
                                                                            const dotClass = DURUM_NOKTASI[durum];
                                                                            const textClass = durum === 'basarisiz' ? 'text-rose-400' : durum === 'basarili' ? 'text-emerald-400' : 'text-amber-400';
                                                                            return (
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`h-2 w-2 rounded-full ${dotClass}`} />
                                                                                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${textClass}`}>{label}</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()
                                    )
                                    }

                                    {transactions.length > 0 && (
                                        <div className="mt-8 flex flex-col items-center justify-between gap-6 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] pt-8 sm:flex-row">
                                            <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">
                                                Toplam {formatNumber(totalCount)} işlemden {(page - 1) * rowsPerPage + 1}-{Math.min(page * rowsPerPage, totalCount)} arası gösteriliyor
                                            </p>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handlePageChange(1)}
                                                    disabled={page === 1}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white disabled:opacity-20 transition-all"
                                                    title="İlk Sayfa"
                                                >
                                                    <ChevronsLeft size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handlePageChange(page - 1)}
                                                    disabled={page === 1}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white disabled:opacity-20 transition-all"
                                                    title="Önceki Sayfa"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>

                                                <form onSubmit={handleJumpPage} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20 mx-1">
                                                    <input
                                                        type="text"
                                                        value={jumpPage}
                                                        onChange={(e) => setJumpPage(e.target.value)}
                                                        onBlur={() => setJumpPage(page.toString())}
                                                        className="w-8 bg-transparent text-center text-sm font-semibold text-white outline-none"
                                                    />
                                                    <span className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">/</span>
                                                    <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">{totalPages}</span>
                                                </form>

                                                <button
                                                    onClick={() => handlePageChange(page + 1)}
                                                    disabled={page === totalPages}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white disabled:opacity-20 transition-all"
                                                    title="Sonraki Sayfa"
                                                >
                                                    <ChevronLeft size={16} className="rotate-180" />
                                                </button>
                                                <button
                                                    onClick={() => handlePageChange(totalPages)}
                                                    disabled={page === totalPages}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white disabled:opacity-20 transition-all"
                                                    title="Son Sayfa"
                                                >
                                                    <ChevronsLeft size={16} className="rotate-180" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {
                                activeTab === 'detailed-report' && (
                                    <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 backdrop-blur-md text-left">
                                        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-400">Detaylı Oyuncu Raporu</h3>
                                                <BarChart3 className="text-blue-400" size={20} />
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Tarih</span>
                                                    <button
                                                        onClick={() => handleDetailedReportQuickDate('today')}
                                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all uppercase tracking-widest ${detStart === todayYMD && detEnd === todayYMD ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/10 hover:text-white'}`}
                                                    >
                                                        Bugün
                                                    </button>
                                                    <button
                                                        onClick={() => handleDetailedReportQuickDate('yesterday')}
                                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all uppercase tracking-widest ${detStart === detEnd && detStart === yesterdayYMD ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/10 hover:text-white'}`}
                                                    >
                                                        Dün
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-blue-400" />
                                                    <input
                                                        type="date"
                                                        value={detStart}
                                                        onChange={(e) => setDetStart(e.target.value)}
                                                        className="bg-transparent text-xs font-semibold text-white outline-none [color-scheme:dark]"
                                                    />
                                                    <span className="text-[color:var(--panel-faint,#5c6470)] font-bold">/</span>
                                                    <input
                                                        type="date"
                                                        value={detEnd}
                                                        onChange={(e) => setDetEnd(e.target.value)}
                                                        className="bg-transparent text-xs font-semibold text-white outline-none [color-scheme:dark]"
                                                    />
                                                    <span className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] tabular-nums">
                                                        {ymdToDDMMYY(detStart)} / {ymdToDDMMYY(detEnd)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (kpi?.LastDepositTimeLocal) {
                                                            setDetStart(kpi.LastDepositTimeLocal.slice(0, 10));
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all uppercase tracking-widest"
                                                >
                                                    Son Yatırıma Git
                                                </button>
                                            </div>
                                        </div>

                                        {isDetailedReportLoading ? (
                                            <div className="py-20 text-center animate-pulse text-[color:var(--panel-muted,#8a919c)] font-bold uppercase text-[10px] tracking-widest">Rapor Hazırlanıyor...</div>
                                        ) : !detailedReportData?.Data || detailedReportData.Data.length === 0 ? (
                                            <div className="py-20 text-center text-[color:var(--panel-muted,#8a919c)] italic text-sm">Bu oyuncu için detaylı bir rapor bulunamadı.</div>
                                        ) : (
                                            <div className="space-y-12">
                                                {detailedReportData.Data.map((report: any, idx: number) => (
                                                    <div key={idx} className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                                                        <section>
                                                            <div className="mb-3 flex items-center gap-3 text-left">
                                                                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-500">Bakiye ve Bonus Özeti</h3>
                                                                <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                                <StatBox
                                                                    title="Güncel Bakiye"
                                                                    value={`${formatNumber(report.CurrentBalance)} TRY`}
                                                                    icon={Wallet}
                                                                    colorClass="bg-blue-500/10 text-blue-400"
                                                                />
                                                                <StatBox
                                                                    title="Toplam Bakiye"
                                                                    value={`${formatNumber(report.TotalBalance)} TRY`}
                                                                    subValue="Bakiye + Bonus"
                                                                    icon={Layers}
                                                                    colorClass="bg-blue-500/10 text-blue-400"
                                                                />
                                                                <StatBox
                                                                    title="Aktif Bonus"
                                                                    value={`${formatNumber(report.ActiveBonusAmount)} TRY`}
                                                                    subValue={report.ActiveBonusType ? `Tip: ${report.ActiveBonusType}` : "Aktif Bonus"}
                                                                    icon={Gift}
                                                                    colorClass="bg-blue-500/10 text-blue-400"
                                                                />
                                                                <StatBox
                                                                    title="Birikmiş Bonus"
                                                                    value={`${formatNumber(report.SumBonusBalance)} TRY`}
                                                                    icon={Coins}
                                                                    colorClass="bg-amber-500/10 text-amber-400"
                                                                />
                                                            </div>
                                                        </section>

                                                        <section>
                                                            <div className="mb-3 flex items-center gap-3 text-left">
                                                                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-500">Dönem Performansı</h3>
                                                                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                                <StatBox
                                                                    title="Net Kar/Zarar"
                                                                    value={`${formatNumber(report.NetProfit)} TRY`}
                                                                    icon={DollarSign}
                                                                    colorClass={report.NetProfit >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
                                                                    subValue="Toplam"
                                                                />
                                                                <StatBox
                                                                    title="Kar (Bonus Hariç)"
                                                                    value={`${formatNumber(report.NetProfitLessBonus)} TRY`}
                                                                    icon={TrendingUp}
                                                                    colorClass={report.NetProfitLessBonus >= 0 ? "bg-cyan-500/10 text-cyan-400" : "bg-rose-500/10 text-rose-400"}
                                                                    subValue="Nakiti Koruma"
                                                                />
                                                                <StatBox
                                                                    title="Toplam Yatırım"
                                                                    value={`${formatNumber(report.DepositAmount)} TRY`}
                                                                    subValue={`${formatNumber(report.DepositCount)} İşlem`}
                                                                    icon={ArrowUpRight}
                                                                    colorClass="bg-emerald-500/10 text-emerald-400"
                                                                />
                                                                <StatBox
                                                                    title="Toplam Çekim"
                                                                    value={`${formatNumber(report.WithdrawalAmount)} TRY`}
                                                                    subValue={`${formatNumber(report.WithdrawalCount)} İşlem`}
                                                                    icon={ArrowDownRight}
                                                                    colorClass="bg-rose-500/10 text-rose-400"
                                                                />
                                                            </div>
                                                        </section>

                                                        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                                                            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 text-left backdrop-blur-md">
                                                                <div className="mb-8 flex items-center justify-between">
                                                                    <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-400">Sportbook Analizi</h3>
                                                                    <TrendingUp className="text-blue-400" size={20} />
                                                                </div>
                                                                <div className="space-y-4">
                                                                    <DetailRow label="Toplam Bahis" value={formatNumber(report.SportTotalBetAmount)} unit="TRY" icon={Activity} color="indigo" />
                                                                    <DetailRow label="Bahis Sayısı" value={report.SportBetCount} icon={History} color="indigo" />
                                                                    <DetailRow label="Bonus Bahisleri" value={formatNumber(report.SportBonusBetAmount)} unit="TRY" icon={Gift} color="purple" />
                                                                    <DetailRow label="Gerçek Para Kazanç" value={formatNumber(report.SportRealMoneyWonAmount)} unit="TRY" icon={Trophy} color="emerald" />
                                                                    <DetailRow label="Bonus Kazançları" value={formatNumber(report.SportBonusWinAmount)} unit="TRY" icon={Gift} color="purple" />
                                                                    <DetailRow label="Net Kar" value={formatNumber(report.SportNetProfit)} unit="TRY" icon={TrendingUp} color={report.SportNetProfit >= 0 ? "emerald" : "rose"} />
                                                                    <DetailRow label="Net Kar (Bonus Hariç)" value={formatNumber(report.SportNetProfitLessBonus)} unit="TRY" icon={TrendingDown} color={report.SportNetProfitLessBonus >= 0 ? "emerald" : "rose"} />
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 text-left backdrop-blur-md">
                                                                <div className="mb-8 flex items-center justify-between">
                                                                    <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-400">Casino Analizi</h3>
                                                                    <Gamepad2 className="text-blue-400" size={20} />
                                                                </div>
                                                                <div className="space-y-4">
                                                                    <DetailRow label="Toplam Ciro" value={formatNumber(report.CasinoTotalBetAmount)} unit="TRY" icon={Activity} color="purple" />
                                                                    <DetailRow label="Oyun Sayısı" value={report.CasinoBetCount} icon={History} color="purple" />
                                                                    <DetailRow label="Bonus Bahisleri" value={formatNumber(report.CasinoBonusBetAmount)} unit="TRY" icon={Gift} color="purple" />
                                                                    <DetailRow label="Gerçek Para Kazanç" value={formatNumber(report.CasinoRealMoneyWonAmount)} unit="TRY" icon={Trophy} color="emerald" />
                                                                    <DetailRow label="Bonus Kazançları" value={formatNumber(report.CasinoBonusWinAmount)} unit="TRY" icon={Gift} color="purple" />
                                                                    <DetailRow label="Net Kar" value={formatNumber(report.CasinoNetProfit)} unit="TRY" icon={TrendingUp} color={report.CasinoNetProfit >= 0 ? "emerald" : "rose"} />
                                                                    <DetailRow label="Net Kar (Bonus Hariç)" value={formatNumber(report.CasinoNetProfitLessBonus)} unit="TRY" icon={TrendingDown} color={report.CasinoNetProfitLessBonus >= 0 ? "emerald" : "rose"} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-10">
                                                            <h4 className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.5em] text-[color:var(--panel-muted,#8a919c)]">Dönem Sonu ve Bonus Kazanımları</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                                                <InfoTile label="Real Para Toplam Kazanç" value={`${formatNumber(report.RealMoneyWonAmount)} TRY`} icon={Trophy} isSuccess={true} />
                                                                <InfoTile label="Bonus Toplam Kazanç" value={`${formatNumber(report.BonusWonAmount)} TRY`} icon={Gift} />
                                                                <InfoTile label="Convert Edilen Bonus" value={`${formatNumber(report.ConvertedBonusAmount)} TRY`} icon={Coins} />
                                                            </div>
                                                        </section>

                                                        <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-10 backdrop-blur-md">
                                                            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
                                                                <div className="min-w-0 text-left">
                                                                    <p className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest mb-3">Dönem Başlangıç Bakiyesi</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 ring-1 ring-blue-500/20">
                                                                            <Wallet size={20} />
                                                                        </div>
                                                                        <p className="text-xl font-semibold text-white">{formatNumber(report.PeriodStartBalance)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></p>
                                                                    </div>
                                                                    <p className="mt-2 text-[9px] text-[color:var(--panel-muted,#8a919c)] italic">Casino: {formatNumber(report.CasinoPeriodStartBalance)}</p>
                                                                </div>

                                                                <div className="min-w-0 text-left">
                                                                    <p className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest mb-3">Dönem Bitiş Bakiyesi</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 ring-1 ring-emerald-500/20">
                                                                            <CheckCircle2 size={20} />
                                                                        </div>
                                                                        <p className="text-xl font-semibold text-white">{formatNumber(report.PeriodEndBalance)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></p>
                                                                    </div>
                                                                    <p className="mt-2 text-[9px] text-[color:var(--panel-muted,#8a919c)] italic">Casino: {formatNumber(report.CasinoPeriodEndBalance)}</p>
                                                                </div>

                                                                <div className="min-w-0 text-left">
                                                                    <p className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest mb-3">Kayıt Bilgileri</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 ring-1 ring-amber-500/20">
                                                                            <Calendar size={20} />
                                                                        </div>
                                                                        <p className="text-sm font-semibold text-white">{formatDateTimeDisplay(report.RegistrationDateLocal)}</p>
                                                                    </div>
                                                                    <p className="mt-2 text-[9px] text-[color:var(--panel-muted,#8a919c)]">BTag: {report.BTag || 'Yok'}</p>
                                                                </div>

                                                                <div className="min-w-0 text-left">
                                                                    <p className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest mb-3">Hesap Detayı</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 ring-1 ring-blue-500/20">
                                                                            <Users size={20} />
                                                                        </div>
                                                                        <p className="text-sm font-semibold text-white">{report.IsVerified ? 'ONAYLI HESAP' : 'ONAYSIZ'}</p>
                                                                    </div>
                                                                    <p className="mt-2 text-[9px] text-[color:var(--panel-muted,#8a919c)]">Affilate ID: {report.AffilateId || 'Mevcut Değil'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}

                            {activeTab === 'ip-addresses' && (
                                <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-8 backdrop-blur-md text-left">
                                    <NetworkMap loginIp={loginIP || null} clientId={id!} />
                                </section>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </Tabs.Root>
        </motion.div >
    );
}

function StatBox({ title, value, subValue, icon: Icon, colorClass }: any) {
    return (
        <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-current/10', colorClass)}>
                    <Icon size={16} />
                </div>
                {subValue && (
                    <span className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-wider bg-white/5 px-2.5 py-0.5 rounded-full">
                        {subValue}
                    </span>
                )}
            </div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--panel-muted,#8a919c)]">{title}</p>
            <p className="text-lg font-bold tracking-[-0.025em] text-white">{value}</p>
        </Card>
    );
}

function DetailRow({ label, value, unit, icon: Icon, color }: any) {
    const colorMap: Record<string, string> = {
        indigo: 'bg-blue-500/10 text-blue-400',
        emerald: 'bg-emerald-500/10 text-emerald-400',
        rose: 'bg-rose-500/10 text-rose-400',
        purple: 'bg-blue-500/10 text-blue-400',
    };
    return (
        <div className={cn(
            'flex min-h-9 items-center justify-between rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/15 px-2.5 py-2 transition-colors hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]',
        )}>
            <div className="flex items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', colorMap[color] ?? colorMap.indigo)}>
                    <Icon size={14} />
                </div>
                <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)]">{label}</span>
            </div>
            <span className={cn(
                'text-xs font-bold',
                color === 'emerald' && 'text-emerald-400',
                color === 'rose' && 'text-rose-400',
                !['emerald', 'rose'].includes(color) && 'text-white'
            )}>
                {value} {unit && <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)] font-bold ml-1">{unit}</span>}
            </span>
        </div>
    );
}

function InfoTile({ label, value, icon: Icon, isSuccess }: any) {
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.035] text-[color:var(--panel-muted,#8a919c)] ring-1 ring-white/[0.05]">
                <Icon size={15} />
            </div>
            <div className="min-w-0 text-left">
                <p className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-wider">{label}</p>
                <p className={cn(
                    'mt-0.5 truncate text-xs font-semibold tracking-tight',
                    (isSuccess || value === 'ONAYLI HESAP') ? 'text-emerald-400' : 'text-white'
                )}>
                    {value}
                </p>
            </div>
        </div>
    );
}
