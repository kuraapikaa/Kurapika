/**
 * Oyuncu analiz karnesi.
 *
 * Etiket, risk ve persona mantığı `lib/oyuncuEtiketleri` içinde ve
 * testlidir. "Bütün profillerde alakasız filtreler çıkıyor" şikâyetinin
 * sebebi orada anlatılıyor: anlık bakiyeye bakan bonus kontrolü, tek
 * sinyalden dört rozet üreten kopyalar ve eşiksiz risk kuralları.
 *
 * Bu dosya artık yalnızca çiziyor. Bir rozetin neden çıktığı `title`
 * ile okunabilir — operatör "bu neden yazıyor" diye sormasın diye.
 */
import { BrainCircuit, AlertTriangle, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  oyuncuEtiketleri,
  oyuncuPersonasi,
  riskSeviyesi,
  tercihEdilenKategori,
  type EtiketTonu,
  type OyuncuOlculeri,
  type RiskSeviyesi,
} from '../lib/oyuncuEtiketleri';

interface AIPlayerInsightProps {
    data: any; // KPI Data
    ipData: any; // IP Data
    /** Oyuncunun bonus geçmişi. Verilmezse bonus etiketi HİÇ üretilmez. */
    bonuslar?: unknown[];
}

const TON_SINIFI: Record<EtiketTonu, string> = {
    bilgi: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    olumlu: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    notr: 'border-white/5 bg-[rgba(242,244,248,0.08)] text-slate-300',
    uyari: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    tehlike: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
};

const RISK_SINIFI: Record<RiskSeviyesi, string> = {
    'DÜŞÜK': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'ORTA': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'YÜKSEK': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    'KRİTİK': 'bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse',
};

/** Alan yoksa `null` kalır — sıfıra çevrilmez; etiket mantığı bu ayrıma dayanıyor. */
function olcu(deger: unknown): number | null {
    if (deger === null || deger === undefined || deger === '') return null;
    const sayi = Number(deger);
    return Number.isFinite(sayi) ? sayi : null;
}

export function AIPlayerInsight({ data, ipData, bonuslar }: AIPlayerInsightProps) {
    if (!data) return null;

    const sporHacmi = olcu(data.TotalSportStakes);
    const casinoHacmi = olcu(data.TotalCasinoStakes);

    const olculer: OyuncuOlculeri = {
        yatirimTutari: olcu(data.DepositAmount),
        yatirimAdedi: olcu(data.DepositCount),
        cekimTutari: olcu(data.WithdrawalAmount),
        netKarZarar: olcu(data.ProfitAndLose),
        sporHacmi,
        casinoHacmi,
        kayitTarihi: data.RegistrationDate ?? data.rawDetail?.registrationDate ?? data.CreatedLocalDate ?? null,
        // Bonus geçmişi gelmediyse null: "bilinmiyor" ile "hiç almamış" ayrı şeyler.
        bonusAdedi: Array.isArray(bonuslar) ? bonuslar.length : null,
        ayniIpHesapSayisi: Array.isArray(ipData?.Data?.Objects) ? ipData.Data.Objects.length : null,
        // Uc durumlu: alan gelmediyse null kalir, "dogrulanmamis" denmez.
        telefonDogrulandi: typeof data.IsPhoneVerified === 'boolean' ? data.IsPhoneVerified : null,
    };

    const etiketler = oyuncuEtiketleri(olculer);
    const risk = riskSeviyesi(olculer);
    const persona = oyuncuPersonasi(olculer);
    const kategori = tercihEdilenKategori(olculer);

    const hesapSayisi = olculer.ayniIpHesapSayisi;
    const cokluHesap = hesapSayisi !== null && hesapSayisi > 1;
    const oyuncuOnde = olculer.netKarZarar !== null && olculer.netKarZarar < 0;
    const yatirimAdedi = olculer.yatirimAdedi;

    const personaSimgesi =
        risk === 'KRİTİK' || risk === 'YÜKSEK' ? <AlertTriangle size={18} className="text-rose-400" />
        : persona.ad === 'VIP' ? <Sparkles size={18} className="text-amber-400" />
        : persona.ad === 'Mikro oyuncu' ? <Zap size={18} className="text-purple-300" />
        : <ShieldCheck size={18} className="text-slate-400" />;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-blue-500/30 bg-blue-950/20 p-8 md:p-8 backdrop-blur-xl mb-8 relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-400/20 transition-colors" />

            <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
                <div className="flex-shrink-0 bg-purple-400/20 p-8 rounded-3xl border border-blue-500/30 backdrop-blur-xl">
                    <BrainCircuit size={32} className="text-purple-300" />
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-purple-300 tracking-wide uppercase">Bugs Software AI Analiz Karnesi</h3>
                        <span className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full border ${RISK_SINIFI[risk]}`}>
                            Risk Seviyesi: {risk}
                        </span>
                        <div
                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full border border-white/5 bg-black/20 text-slate-300"
                            title={persona.aciklama}
                        >
                            {personaSimgesi} {persona.ad}
                        </div>
                    </div>

                    {etiketler.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {etiketler.map((etiket) => (
                                <span
                                    key={etiket.id}
                                    title={etiket.aciklama}
                                    className={`cursor-help rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${TON_SINIFI[etiket.ton]}`}
                                >
                                    {etiket.etiket}
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="text-sm md:text-base text-blue-100/80 leading-relaxed font-medium">
                        {kategori ? (
                            <>
                                Bu oyuncu ağırlıklı olarak <span className="font-bold text-white border-b border-white/5 pb-0.5">{kategori}</span> tarafında oynuyor.
                                {yatirimAdedi !== null && (
                                    <> Bugüne kadar <span className="font-mono text-emerald-400 font-bold">{yatirimAdedi} kez</span> yatırım yapmış.</>
                                )}
                                {olculer.netKarZarar !== null && (
                                    <> Kasaya karşı <span className={`font-mono font-bold ${oyuncuOnde ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {oyuncuOnde ? 'kârda' : 'zararda'}
                                    </span>.</>
                                )}
                            </>
                        ) : yatirimAdedi !== null && yatirimAdedi > 0 ? (
                            <>
                                Bu oyuncu <span className="font-mono text-emerald-400 font-bold">{yatirimAdedi} kez</span> yatırım yapmış ancak bahis hacmi görünmüyor.
                            </>
                        ) : yatirimAdedi === 0 ? (
                            <>Bu hesabın yatırımı da bahsi de yok. Pasif kullanıcı.</>
                        ) : (
                            <>Bu hesap için finansal ölçü gelmedi; profil çıkarılamıyor.</>
                        )}

                        {/*
                          * IP verisi GELMEDIYSE hiçbir şey iddia edilmez. Eski
                          * sürüm bu durumda "multi-account ağına rastlanmadı"
                          * diyerek yapılmamış bir kontrolü olumlu rapor
                          * ediyordu.
                          */}
                        {hesapSayisi === null ? (
                            <span className="text-slate-400 ml-1">IP bağlantı verisi yüklenmedi; çoklu hesap kontrolü yapılmadı.</span>
                        ) : cokluHesap ? (
                            <span className="text-amber-400 ml-1">Aynı IP üzerinden {hesapSayisi} hesapla bağlantı tespit edildi, manuel inceleme önerilir.</span>
                        ) : (
                            <span className="text-emerald-400 ml-1">Aynı IP üzerinde başka hesap görülmedi.</span>
                        )}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
