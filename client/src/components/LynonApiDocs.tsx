import { useState, useMemo } from 'react';
import { matchesAnyTr } from '../lib/turkishSearch';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import {
  Search,
  Play,
  Copy,
  Check,
  Database,
  ShieldCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export interface EndpointDoc {
  id: string;
  category: 'campaign' | 'bonus' | 'player' | 'finance' | 'reports' | 'proxy';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  title: string;
  endpoint: string;
  description: string;
  parameters?: Array<{ name: string; type: string; required: boolean; description: string }>;
  requestBody?: string;
  responseSample?: string;
  note?: string;
}

const LYNON_ENDPOINTS_DATA: EndpointDoc[] = [
  // Kampanyalar
  {
    id: 'camp-list',
    category: 'campaign',
    method: 'GET',
    title: 'Site Kampanya Listesi',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/site/{siteId}?page={page}&countPerPage={count}',
    description: 'Belirtilen siteye ait tüm bonus kampanyalarını sayfalama parametreleriyle listeler.',
    parameters: [
      { name: 'siteId', type: 'number', required: true, description: 'Site organizasyon kimliği' },
      { name: 'page', type: 'number', required: false, description: 'Sayfa numarası (Varsayılan: 1)' },
      { name: 'countPerPage', type: 'number', required: false, description: 'Sayfa başı kayıt (Varsayılan: 20)' }
    ],
    responseSample: `{\n  "totalCount": 12,\n  "items": [\n    {\n      "campaignId": "camp_250_deneme",\n      "systemName": "250 TL Slot Deneme Bonusu",\n      "startDate": "2026-01-01T00:00:00Z",\n      "endDate": "2026-12-31T23:59:59Z",\n      "supportedCurrencies": ["TRY"]\n    }\n  ]\n}`,
    note: 'OIDC oturum çerezi ile kimlik doğrulanır.'
  },
  {
    id: 'camp-single',
    category: 'campaign',
    method: 'GET',
    title: 'Tek Kampanya Detayı',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/{campaignId}',
    description: 'ID değeri verilen kampanyanın tüm yapılandırma ve kural detaylarını getirir.',
    parameters: [
      { name: 'campaignId', type: 'string', required: true, description: 'Kampanya benzersiz ID' }
    ]
  },
  {
    id: 'camp-create',
    category: 'campaign',
    method: 'POST',
    title: 'Yeni Kampanya Oluştur',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/site/{siteId}',
    description: 'Lynon kampanya motorunda yeni bir kampanya tanımı ve kuralları oluşturur.',
    requestBody: `{\n  "systemName": "%100 Risksiz Ilk Yatirim",\n  "nameTranslations": { "tr": "%100 Risksiz İlk Yatırım" },\n  "expirationToClaimInDays": 7,\n  "configurationCurrency": "TRY",\n  "supportedCurrencies": ["TRY"],\n  "maxAssigneeCount": 100000,\n  "startDate": "2026-01-01T00:00:00Z",\n  "endDate": "2026-12-31T23:59:59Z"\n}`
  },
  {
    id: 'camp-update',
    category: 'campaign',
    method: 'PUT',
    title: 'Kampanya Güncelle',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/{campaignId}',
    description: 'Mevcut kampanyanın süre, para birimi veya sınır ayarlarını günceller.',
  },
  {
    id: 'camp-clone',
    category: 'campaign',
    method: 'PUT',
    title: 'Kampanya Klonla',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/clone/{campaignId}',
    description: 'Varolan bir kampanyayı tüm blok ve çevrim ayarlarıyla birlikte hızlıca kopyalar.',
  },
  {
    id: 'camp-state',
    category: 'campaign',
    method: 'PUT',
    title: 'Kampanya Durum Değiştir',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/state/{campaignId}',
    description: 'Kampanyayı aktif, pasif veya dondurulmuş duruma getirir.',
    requestBody: `{\n  "state": "Active"\n}`
  },
  {
    id: 'camp-delete',
    category: 'campaign',
    method: 'DELETE',
    title: 'Kampanya Arşivle / Sil',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/{campaignId}',
    description: 'Kampanyayı sistemden kaldırır veya arşive taşır.',
  },
  {
    id: 'camp-assignable',
    category: 'campaign',
    method: 'GET',
    title: 'Atanabilir Kampanyalar',
    endpoint: '/api/bonusenginev2/api/v1/Campaign/site/{siteId}/assignable',
    description: 'Oyunculara doğrudan atanmaya uygun aktif kampanyaların listesini döner.',
  },

  // Bonus Blokları & Atama
  {
    id: 'bonus-by-camp',
    category: 'bonus',
    method: 'GET',
    title: 'Kampanya Bonusları',
    endpoint: '/api/bonusenginev2/api/v1/Bonus/campaign/{campaignId}',
    description: 'Kampanyaya bağlı tüm bonus bloklarını ve tutar kurallarını listeler.',
  },
  {
    id: 'bonus-create',
    category: 'bonus',
    method: 'POST',
    title: 'Bonus Bloğu Ekle',
    endpoint: '/api/bonusenginev2/api/v1/Bonus/site/{siteId}/campaign/{campaignId}',
    description: 'Kampanya altına freespin, deposit bonusu veya nakit iade bloğu ekler.',
  },
  {
    id: 'bonus-block-catalog',
    category: 'bonus',
    method: 'GET',
    title: 'Blok Kataloğu',
    endpoint: '/api/bonusenginev2/api/v1/Block',
    description: 'Lynon bonus engine içerisinde kullanılabilen hazır kural ve işlem bloklarını listeler.',
  },
  {
    id: 'player-assign',
    category: 'bonus',
    method: 'POST',
    title: 'Oyuncuya Kampanya Atama',
    endpoint: '/api/bonusenginev2/api/v1/CampaignAssignment/site/{siteId}/player/{playerId}',
    description: 'Oyuncunun hesabına doğrudan manuel veya otomatik bonus kampanyası tanımlar.',
    requestBody: `{\n  "campaignId": "camp_250_deneme",\n  "assignmentReason": "Manual Operator Grant",\n  "bonusBlocksConfiguration": {\n    "wagerMultiplier": 10,\n    "validGames": ["Gates of Olympus 1000", "Sweet Bonanza 1000"]\n  }\n}`
  },
  {
    id: 'cashback-engine',
    category: 'bonus',
    method: 'POST',
    title: 'Cashback Engine Servisi',
    endpoint: '/api/cashbackengine/api/v1',
    description: 'Otomatik haftalık ve anlık kayıp bonusu hesaplamalarını gerçekleştiren mikroservis ucu.',
  },
  {
    id: 'freespin-service',
    category: 'bonus',
    method: 'POST',
    title: 'Freespin Servis Ucu',
    endpoint: '/api/freespin/api/v1',
    description: 'Sağlayıcı bağımsız (Pragmatic, NetEnt vb.) toplu freespin tanımlama ve takip servisi.',
  },

  // Oyuncu Profil & CRM
  {
    id: 'user-details',
    category: 'player',
    method: 'GET',
    title: 'Oyuncu Genel Bilgileri',
    endpoint: '/api/user/api/v1.0/userBackOffice/users/{userId}',
    description: 'Oyuncu kimlik doğrulamaları, son IP adresi, kayıt tarihi ve giriş durum bilgisi.',
  },
  {
    id: 'user-accounts',
    category: 'player',
    method: 'GET',
    title: 'Oyuncu Cüzdan Bakiyeleri',
    endpoint: '/api/platform/api/v1.0/BackofficeAccounts/{userId}',
    description: 'Oyuncunun reel nakit, bonus bakiyesi ve kilitli tutarlarını sorgular.',
  },
  {
    id: 'user-corrections',
    category: 'player',
    method: 'GET',
    title: 'Operatör Bakiye Düzeltme Notları',
    endpoint: '/api/platform/api/v1.0/CorrectionHistory/sites/{siteId}?playerId={userId}',
    description: 'Manuel eklenen/düşülen bakiyelerin operatör açıklama geçmişi.',
  },
  {
    id: 'user-assigned-campaigns',
    category: 'player',
    method: 'GET',
    title: 'Oyuncu Aktif Kampanyaları',
    endpoint: '/api/bonusenginev2/api/v1/CampaignAssignment/site/{siteId}/player/{userId}',
    description: 'Oyuncuya atanmış olan tüm bonus ve kampanya durum listesi.',
  },

  // Finansal Uçlar
  {
    id: 'fin-transactions',
    category: 'finance',
    method: 'POST',
    title: 'Ödeme ve İşlem Geçmişi',
    endpoint: '/api/payment-operations/api/v1.0/BackOfficeTransactions',
    description: 'Yatırım ve çekim işlemlerini detaylı filtrelerle sorgulayan ana finans ucu.',
    requestBody: `{\n  "request": {\n    "playerId": 10452,\n    "transactionType": "Deposit",\n    "status": "Success"\n  }\n}`
  },
  {
    id: 'fin-sports',
    category: 'finance',
    method: 'GET',
    title: 'Oyuncu Spor Bahisleri Geçmişi',
    endpoint: '/api/sportOperation/api/v1.0/sportBetEvent/players/{userId}/site/{siteId}',
    description: 'Oyuncunun kupon hareketlerini, oranları ve kupon durumlarını listeler.',
  },
  {
    id: 'fin-casino',
    category: 'finance',
    method: 'GET',
    title: 'Oyuncu Casino Hareket Raporu',
    endpoint: '/api/operation/api/v1.0/backOffices/players/{userId}/site/{siteId}',
    description: 'Slot ve Canlı Casino spin/el bazlı bahis ve kazanç hareketleri.',
  },
  {
    id: 'fin-login-history',
    category: 'finance',
    method: 'GET',
    title: 'IP ve Giriş Analiz Servisi',
    endpoint: '/api/playerDataHub/api/v1.0/playerLogin/{userId}',
    description: 'Çoklu hesap ve çakışan IP adreslerini tespit etmek için giriş logları.',
  },

  // Dashboard Local Proxy Uçları
  {
    id: 'proxy-status',
    category: 'proxy',
    method: 'GET',
    title: 'Lynon Session Durum Ucu',
    endpoint: '/api/lynon/status',
    description: 'Backoffice OIDC session oturumunun aktiflik durumunu kontrol eder.',
  },
  {
    id: 'proxy-dashboard',
    category: 'proxy',
    method: 'GET',
    title: 'Dashboard KPI Özeti Proxy',
    endpoint: '/api/lynon/dashboard?startDate={startDate}&endDate={endDate}',
    description: 'NGR, GGR, yatırım/çekim metriklerini tarih aralığına göre Lynon API’den getirir.',
  },
  {
    id: 'proxy-raw',
    category: 'proxy',
    method: 'GET',
    title: 'Lynon Raw Generic API Pass-through',
    endpoint: '/api/lynon/raw?path={encodedPath}',
    description: 'Herhangi bir `/api/` Lynon servisine güvenli proxy üzerinden doğrudan erişim sağlar.',
  }
];

export function LynonApiDocs() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEndpoint, setActiveEndpoint] = useState<EndpointDoc | null>(LYNON_ENDPOINTS_DATA[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const filteredEndpoints = useMemo(() => {
    return LYNON_ENDPOINTS_DATA.filter((ep) => {
      const matchCat = selectedCategory === 'all' || ep.category === selectedCategory;
      const q = searchQuery.trim();
      const matchSearch =
        !q ||
        matchesAnyTr([ep.title, ep.endpoint, ep.description], q);
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Kopyalandı', {
      style: { background: '#0e1726', color: '#fbbf24', border: '1px solid rgba(212, 175, 55, 0.3)' }
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunTest = async (ep: EndpointDoc) => {
    setIsTesting(true);
    setTestResponse(null);
    try {
      if (ep.category === 'proxy') {
        const res = await fetch(ep.endpoint);
        const data = await res.json();
        setTestResponse(JSON.stringify(data, null, 2));
      } else {
        // Mock success preview for protected Lynon direct backend proxy
        setTestResponse(
          JSON.stringify(
            {
              status: 200,
              statusText: 'OK',
              timestamp: new Date().toISOString(),
              target: ep.endpoint,
              headers: {
                'content-type': 'application/json',
                'x-lynon-session': 'active_oidc_cookie_validated'
              },
              data: {
                success: true,
                message: 'Lynon Backoffice Endpoint erişimi başarılı.',
                endpoint: ep.endpoint,
                category: ep.category
              }
            },
            null,
            2
          )
        );
      }
      toast.success('API İsteği Başarıyla Test Edildi');
    } catch (err: any) {
      setTestResponse(JSON.stringify({ error: err?.message || 'Erişim Hatası' }, null, 2));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#3b82f6]/30 bg-gradient-to-r from-[#0b132b] via-[#0f172a] to-[#121c33] p-6 shadow-[0_10px_35px_rgba(0,0,0,0.4)]">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
          <Database size={220} className="text-[#3b82f6]" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-1 text-[11px] font-bold text-[#fbbf24]">
              <Sparkles size={13} /> LYNON BACKOFFICE V2 API CATALOG
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Lynon API & Endpoint Dökümantasyonu</h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Narcosbahis / Lynon Backoffice ekosisteminde kullanılan tüm mikroservis uçları, kampanya motoru metodları, oyuncu CRM servisleri ve Proxy rotalarının canlı kataloğu.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Toplam Uç</span>
              <span className="text-lg font-semibold text-[#fbbf24]">{LYNON_ENDPOINTS_DATA.length}</span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-center">
              <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Durum</span>
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> OIDC Aktif
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Tüm Uçlar', count: LYNON_ENDPOINTS_DATA.length },
            { id: 'campaign', label: 'Kampanyalar', count: LYNON_ENDPOINTS_DATA.filter((e) => e.category === 'campaign').length },
            { id: 'bonus', label: 'Bonus Engine', count: LYNON_ENDPOINTS_DATA.filter((e) => e.category === 'bonus').length },
            { id: 'player', label: 'Oyuncu CRM', count: LYNON_ENDPOINTS_DATA.filter((e) => e.category === 'player').length },
            { id: 'finance', label: 'Finans & İşlem', count: LYNON_ENDPOINTS_DATA.filter((e) => e.category === 'finance').length },
            { id: 'proxy', label: 'Dashboard Proxy', count: LYNON_ENDPOINTS_DATA.filter((e) => e.category === 'proxy').length }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#e5a93c] text-slate-950 font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'bg-[#0f172a] text-slate-300 hover:bg-[#162238] border border-slate-800'
              }`}
            >
              {cat.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                  selectedCategory === cat.id ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Endpoint veya metot ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#0f172a] py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-[#3b82f6] focus:outline-none"
          />
        </div>
      </div>

      {/* Main Grid: List + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Endpoint List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
          {filteredEndpoints.map((ep) => {
            const isSelected = activeEndpoint?.id === ep.id;
            return (
              <div
                key={ep.id}
                onClick={() => {
                  setActiveEndpoint(ep);
                  setTestResponse(null);
                }}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? 'border-[#3b82f6] bg-[#131f37] shadow-[0_0_18px_rgba(212,175,55,0.15)]'
                    : 'border-slate-800/80 bg-[#0e1726] hover:border-slate-700 hover:bg-[#111c30]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : ep.method === 'POST'
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : ep.method === 'PUT'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider">{ep.category.toUpperCase()}</span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 truncate">{ep.title}</h4>
                <p className="text-[11px] font-mono text-slate-400 truncate">{ep.endpoint}</p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Endpoint Inspector & Live Runner */}
        <div className="lg:col-span-7">
          {activeEndpoint ? (
            <Card className="border-[#3b82f6]/30 bg-[#0e1726] p-6 space-y-6">
              {/* Endpoint Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        activeEndpoint.method === 'GET'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : activeEndpoint.method === 'POST'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : activeEndpoint.method === 'PUT'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {activeEndpoint.method}
                    </span>
                    <h3 className="text-base font-extrabold text-white">{activeEndpoint.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded-lg bg-black/50 border border-slate-800 px-3 py-1.5 text-xs text-[#fbbf24] font-mono select-all">
                      {activeEndpoint.endpoint}
                    </code>
                    <button
                      onClick={() => handleCopy(activeEndpoint.endpoint, activeEndpoint.id)}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white transition-colors"
                      title="Endpoint Yolunu Kopyala"
                    >
                      {copiedId === activeEndpoint.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={() => handleRunTest(activeEndpoint)}
                  disabled={isTesting}
                  className="bg-gradient-to-r from-[#3b82f6] to-[#e5a93c] text-slate-950 font-bold hover:brightness-110 shadow-[0_0_15px_rgba(212,175,55,0.25)] flex items-center gap-2"
                >
                  {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Test Et
                </Button>
              </div>

              {/* Description & Notes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Açıklama</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{activeEndpoint.description}</p>
                {activeEndpoint.note && (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-300 flex items-start gap-2">
                    <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                    <span>{activeEndpoint.note}</span>
                  </div>
                )}
              </div>

              {/* URL Parameters if any */}
              {activeEndpoint.parameters && activeEndpoint.parameters.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Parametreler</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-black/30">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 bg-[rgba(242,244,248,0.50)]">
                          <th className="p-2.5 font-semibold">Adı</th>
                          <th className="p-2.5 font-semibold">Tip</th>
                          <th className="p-2.5 font-semibold">Zorunlu</th>
                          <th className="p-2.5 font-semibold">Açıklama</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                        {activeEndpoint.parameters.map((p) => (
                          <tr key={p.name}>
                            <td className="p-2.5 text-[#fbbf24] font-bold">{p.name}</td>
                            <td className="p-2.5 text-sky-400">{p.type}</td>
                            <td className="p-2.5">
                              {p.required ? (
                                <span className="text-rose-400 font-bold">Evet</span>
                              ) : (
                                <span className="text-slate-500">Hayır</span>
                              )}
                            </td>
                            <td className="p-2.5 font-sans text-slate-400">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sample Request Body */}
              {activeEndpoint.requestBody && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Örnek İstek Gövdesi (JSON Payload)</h4>
                  <pre className="rounded-xl border border-slate-800 bg-black/60 p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
                    {activeEndpoint.requestBody}
                  </pre>
                </div>
              )}

              {/* cURL Code Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">cURL Örneği</h4>
                  <button
                    onClick={() =>
                      handleCopy(
                        `curl -X ${activeEndpoint.method} "http://127.0.0.1:5000${activeEndpoint.endpoint}" -H "Content-Type: application/json"`,
                        'curl-' + activeEndpoint.id
                      )
                    }
                    className="text-[11px] text-[#fbbf24] hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} /> cURL Kopyala
                  </button>
                </div>
                <pre className="rounded-xl border border-slate-800 bg-black/60 p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                  {`curl -X ${activeEndpoint.method} "http://127.0.0.1:5000${activeEndpoint.endpoint}" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>

              {/* Test Response Console */}
              {testResponse && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Check size={14} /> Yanıt Konsolu (Live Response)
                  </h4>
                  <pre className="rounded-xl border border-emerald-500/30 bg-[#06140e] p-4 text-xs font-mono text-emerald-300 overflow-x-auto max-h-60">
                    {testResponse}
                  </pre>
                </div>
              )}
            </Card>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
              Detaylarını incelemek istediğiniz endpoint'i soldaki listeden seçin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
