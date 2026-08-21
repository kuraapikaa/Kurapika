/**
 * ROTA AGACI.
 *
 * ── Onceki hal ────────────────────────────────────────────────────────
 *
 * Bu dosya 1141 satirdi ve router kurulu olmasina ragmen render icin
 * KULLANILMIYORDU. Yerine elle yazilmis bir dagitici vardi:
 *
 *   1. `pathToTab()` — yolu 34 satirlik if merdiveniyle `TabId`'ye cevirir
 *   2. ~75 satirlik ic ice ternary — oyuncu ve master sayfalari
 *   3. ~110 satirlik `activeTab === 'x' &&` blogu — 33 admin ekrani
 *
 * Ucu de ayni soruyu ("bu yolda ne render edilir") ayri ayri
 * yanitliyordu. Sonuclarindan biri: "public yol" listesi UC yerde
 * tutuluyordu ve uculu ayrismisti — `/yazi-tura` ile `/tas-kagit-makas`
 * render listesindeydi ama TEMA listesinde degildi, bu yuzden oyuncu
 * temasi olmadan aciliyorlardi.
 *
 * ── Simdi ─────────────────────────────────────────────────────────────
 *
 * Tek bir bildirimsel agac. Tema karari `PlayerLayout` altinda olmaktan
 * ibaret; yetki `routeMeta`'daki tek kayittan okunuyor; sol menu ve ust
 * bar layout rotasi oldugu icin sayfa degisiminde yeniden monte edilmiyor.
 */
import { lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminLayout } from './routes/AdminLayout';
import { MasterGuard } from './routes/MasterGuard';
import { PlayerLayout, oyuncuSayfasi } from './routes/PlayerLayout';
import { RequireAuth, type TenantConfig } from './routes/RequireAuth';
import { RequirePermission } from './routes/RequirePermission';

// ── Admin ekranlari ───────────────────────────────────────────────────
// 1961 satir; statik import edildiginde giris paketine giriyordu ve
// panele giren herkes bonus kural editorunu de indiriyordu.
const RulesManager = lazy(() => import('@/pages/admin/RulesManager').then(m => ({ default: m.RulesManager })));
const PanoSayfasi = lazy(() => import('@/pages/admin/PanoSayfasi').then(m => ({ default: m.PanoSayfasi })));
const BonuslarSayfasi = lazy(() => import('@/pages/admin/BonuslarSayfasi').then(m => ({ default: m.BonuslarSayfasi })));
const OyuncularSayfasi = lazy(() => import('@/pages/admin/OyuncularSayfasi').then(m => ({ default: m.OyuncularSayfasi })));
const CekimTalepleriSayfasi = lazy(() => import('@/pages/admin/CekimTalepleriSayfasi').then(m => ({ default: m.CekimTalepleriSayfasi })));
const YatirimlarSayfasi = lazy(() => import('@/pages/admin/YatirimlarSayfasi').then(m => ({ default: m.YatirimlarSayfasi })));
const PlayerProfile = lazy(() => import('@/pages/admin/PlayerProfile').then(m => ({ default: m.PlayerProfile })));
const TransactionsList = lazy(() => import('@/pages/admin/TransactionsList').then(m => ({ default: m.TransactionsList })));
const TopluIslemOzeti = lazy(() => import('@/pages/admin/TopluIslemOzeti').then(m => ({ default: m.TopluIslemOzeti })));
const AutoWithdrawPanel = lazy(() => import('@/pages/admin/AutoWithdrawPanel').then(m => ({ default: m.AutoWithdrawPanel })));
const RiskAnalysisPage = lazy(() => import('@/pages/admin/RiskAnalysisPage').then(m => ({ default: m.RiskAnalysisPage })));
const OyuncuKategorileme = lazy(() => import('@/pages/admin/OyuncuKategorileme').then(m => ({ default: m.OyuncuKategorileme })));
const ManuelDuzeltmeler = lazy(() => import('@/pages/admin/ManuelDuzeltmeler').then(m => ({ default: m.ManuelDuzeltmeler })));
const Mutabakat = lazy(() => import('@/pages/admin/Mutabakat').then(m => ({ default: m.Mutabakat })));
const LiveRadar = lazy(() => import('@/pages/admin/LiveRadar').then(m => ({ default: m.LiveRadar })));
const RegistrationStats = lazy(() => import('@/pages/admin/RegistrationStats').then(m => ({ default: m.RegistrationStats })));
const ProviderReport = lazy(() => import('@/pages/admin/ProviderReport').then(m => ({ default: m.ProviderReport })));
const ClientBonusReport = lazy(() => import('@/pages/admin/ClientBonusReport').then(m => ({ default: m.ClientBonusReport })));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const AdminGames = lazy(() => import('@/pages/admin/AdminGames').then(m => ({ default: m.AdminGames })));
const AdminForms = lazy(() => import('@/pages/admin/AdminForms').then(m => ({ default: m.AdminForms })));
const IFrameGenerator = lazy(() => import('@/pages/admin/IFrameGenerator').then(m => ({ default: m.IFrameGenerator })));
const LoyaltySettings = lazy(() => import('@/pages/admin/LoyaltySettings').then(m => ({ default: m.LoyaltySettings })));
const UserSystem = lazy(() => import('@/pages/admin/UserSystem').then(m => ({ default: m.UserSystem })));
const VIPSettings = lazy(() => import('@/pages/admin/VIPSettings').then(m => ({ default: m.VIPSettings })));
const AffiliatePanel = lazy(() => import('@/pages/admin/AffiliatePanel').then(m => ({ default: m.AffiliatePanel })));
const AdminTournamentSettings = lazy(() => import('@/pages/admin/AdminTournamentSettings').then(m => ({ default: m.AdminTournamentSettings })));

// ── Oyuncu ekranlari ──────────────────────────────────────────────────
const BonusTalepSayfasi = lazy(() => import('@/pages/player/BonusTalepSayfasi').then(m => ({ default: m.BonusTalepSayfasi })));
const PlayerLobby = lazy(() => import('@/pages/player/PlayerLobby').then(m => ({ default: m.PlayerLobby })));
const MillionaireShowcasePage = lazy(() => import('@/pages/player/MillionaireShowcasePage').then(m => ({ default: m.MillionaireShowcasePage })));
const CarkSayfasi = lazy(() => import('@/pages/player/CarkSayfasi').then(m => ({ default: m.CarkSayfasi })));
const KaziKazanSayfasi = lazy(() => import('@/pages/player/KaziKazanSayfasi').then(m => ({ default: m.KaziKazanSayfasi })));
const BeniAraSayfasi = lazy(() => import('@/pages/player/BeniAraSayfasi').then(m => ({ default: m.BeniAraSayfasi })));
const OrtaklikSayfasi = lazy(() => import('@/pages/player/OrtaklikSayfasi').then(m => ({ default: m.OrtaklikSayfasi })));
const YaziTuraSayfasi = lazy(() => import('@/pages/player/YaziTuraSayfasi').then(m => ({ default: m.YaziTuraSayfasi })));
const TasKagitMakasSayfasi = lazy(() => import('@/pages/player/TasKagitMakasSayfasi').then(m => ({ default: m.TasKagitMakasSayfasi })));
const SkorTahminSayfasi = lazy(() => import('@/pages/player/SkorTahminSayfasi').then(m => ({ default: m.SkorTahminSayfasi })));
const DailyTasksPage = lazy(() => import('@/pages/player/DailyTasksPage').then(m => ({ default: m.DailyTasksPage })));
const GunlukTurnuva = lazy(() => import('@/pages/player/GunlukTurnuva').then(m => ({ default: m.GunlukTurnuva })));
const HaftalikTurnuva = lazy(() => import('@/pages/player/HaftalikTurnuva').then(m => ({ default: m.HaftalikTurnuva })));
const AylikTurnuva = lazy(() => import('@/pages/player/AylikTurnuva').then(m => ({ default: m.AylikTurnuva })));
const LoyaltyHub = lazy(() => import('@/pages/player/LoyaltyHub').then(m => ({ default: m.LoyaltyHub })));
const VipSayfasi = lazy(() => import('@/pages/player/VipSayfasi').then(m => ({ default: m.VipSayfasi })));

/**
 * `/player-profile/:id/:login` -> `/oyuncu/:id/:login`
 *
 * BTag raporundaki oyuncu butonu bu adrese gidiyordu ama eski
 * `pathToTab()` bu yolu tanimiyordu; kullanici sessizce panoya dusuyordu.
 */
function EskiProfilYonlendirmesi() {
  const { id, login } = useParams();
  return <Navigate to={`/oyuncu/${id}/${login}`} replace />;
}

export default function App() {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(null);

  // Marka yapilandirmasi oturum boyunca sabit. Eskiden bu istek HER yol
  // degisiminde tekrarlaniyordu (effect'in bagimliligi pathname'di).
  useEffect(() => {
    fetch('/api/tenant-info')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) return;
        setTenantConfig(data);
        if (data.themeColor) {
          document.documentElement.style.setProperty('--primary-color', data.themeColor);
          // Fallback CSS vars for Tailwind
          document.documentElement.style.setProperty('--color-blue-500', data.themeColor); // Quick hack to overwrite default violet
        }
      })
      .catch(console.error);
  }, []);

  return (
    <Routes>
      {/* ── Oyuncu sayfalari (public, narcos temasi) ──────────────── */}
      <Route element={<PlayerLayout />}>
        <Route path="/bonus-talep" element={oyuncuSayfasi(<BonusTalepSayfasi />, 'teal', '#0a0f1a')} />
        <Route path="/lobi" element={oyuncuSayfasi(<PlayerLobby />, 'teal', '#0a0f1a')} />
        <Route path="/milyonerler" element={oyuncuSayfasi(<MillionaireShowcasePage />, 'amber')} />
        <Route path="/cark" element={oyuncuSayfasi(<CarkSayfasi />, 'amber', '#0a0f1a')} />
        <Route path="/kazi-kazan" element={oyuncuSayfasi(<KaziKazanSayfasi />, 'orange', '#0a0f1a')} />
        <Route path="/skor-tahmin" element={oyuncuSayfasi(<SkorTahminSayfasi />, 'emerald')} />
        <Route path="/gorevler" element={oyuncuSayfasi(<DailyTasksPage />, 'cyan')} />
        <Route path="/beni-ara" element={oyuncuSayfasi(<BeniAraSayfasi />, 'sky')} />
        <Route path="/ortaklik" element={oyuncuSayfasi(<OrtaklikSayfasi />, 'amber')} />
        <Route path="/yazi-tura" element={oyuncuSayfasi(<YaziTuraSayfasi />, 'amber')} />
        <Route path="/tas-kagit-makas" element={oyuncuSayfasi(<TasKagitMakasSayfasi />, 'blue')} />
        <Route path="/sadakat" element={oyuncuSayfasi(<LoyaltyHub />, 'amber')} />
        <Route path="/vip" element={oyuncuSayfasi(<VipSayfasi />, 'blue')} />
        <Route path="/turnuva/gunluk" element={oyuncuSayfasi(<GunlukTurnuva />, 'orange')} />
        <Route path="/turnuva/haftalik" element={oyuncuSayfasi(<HaftalikTurnuva />, 'blue')} />
        <Route path="/turnuva/aylik" element={oyuncuSayfasi(<AylikTurnuva />, 'blue')} />
      </Route>

      {/* ── Master paneli (kendi kimlik ucu) ──────────────────────── */}
      <Route path="/master/*" element={<MasterGuard />} />

      {/*
        Eski/artik adresler. Kimlik kapisinin DISINDA duruyorlar: saf
        yonlendirme oturum gerektirmez ve iceride kalsalardi giris
        yapilmadan hic calismazlardi (kapi Outlet yerine giris ekrani
        render eder). Vardiklari admin adresi zaten korunuyor.
      */}
      <Route path="/player-profile/:id/:login" element={<EskiProfilYonlendirmesi />} />
      {/* Eskiden AdminGames bunu window.history.replaceState ile temizliyordu. */}
      <Route path="/admin/oyun-ayarlari/*" element={<Navigate to="/admin/oyun-ayarlari" replace />} />

      {/* ── Admin paneli ──────────────────────────────────────────── */}
      <Route element={<RequireAuth tenantConfig={tenantConfig} />}>
        <Route element={<AdminLayout />}>
          <Route element={<RequirePermission />}>
            <Route index element={<PanoSayfasi />} />
            <Route path="/canli-radar" element={<LiveRadar />} />
            <Route path="/kayit-istatistikleri" element={<RegistrationStats />} />

            <Route path="/para-yatirmalar" element={<YatirimlarSayfasi />} />
            <Route path="/para-cekme-talepleri" element={<CekimTalepleriSayfasi />} />
            <Route path="/admin/auto-withdraw" element={<AutoWithdrawPanel />} />
            <Route path="/islemler" element={<TransactionsList />} />
            <Route path="/toplu-islem-ozeti" element={<TopluIslemOzeti />} />

            <Route path="/oyuncular" element={<OyuncularSayfasi />} />
            <Route path="/oyuncu/:id/:login" element={<PlayerProfile />} />
            <Route path="/risk-analizi" element={<RiskAnalysisPage />} />
            <Route path="/oyuncu-kategorileme" element={<OyuncuKategorileme />} />
            <Route path="/admin/kullanici-sistemi" element={<UserSystem />} />
            <Route path="/affiliate" element={<AffiliatePanel />} />

            <Route path="/bonuslar" element={<BonuslarSayfasi />} />
            <Route path="/bonus-kurallari" element={<RulesManager />} />
            <Route path="/tum-bonus-raporu" element={<ClientBonusReport />} />
            <Route path="/loyalty-ayarlari" element={<LoyaltySettings />} />
            <Route path="/admin/vip-ayarlari" element={<VIPSettings />} />

            {/* Bes yol da AdminGames'in ayri bir sekmesini tek basina acar. */}
            <Route path="/admin/sans-carki" element={<AdminGames initialTab="wheel" />} />
            <Route path="/admin/kazi-kazan-yonetimi" element={<AdminGames initialTab="scratch" />} />
            <Route path="/admin/skor-tahmin-yonetimi" element={<AdminGames initialTab="prediction" />} />
            <Route path="/admin/kazanc-vitrini" element={<AdminGames initialTab="millionaires" />} />
            <Route path="/admin/gunluk-gorevler" element={<AdminGames initialTab="dailyTasks" />} />
            <Route path="/admin/lobi-tasarimi" element={<AdminGames initialTab="lobby" />} />
            <Route path="/admin/oyun-ayarlari" element={<AdminGames />} />
            <Route path="/turnuva-ayarlari" element={<AdminTournamentSettings />} />

            <Route path="/saglayici-raporu" element={<ProviderReport />} />
            <Route path="/manuel-duzeltmeler" element={<ManuelDuzeltmeler />} />
            <Route path="/mutabakat" element={<Mutabakat />} />
            <Route path="/audit" element={<AuditLogPage />} />

            <Route path="/admin/formlar" element={<AdminForms />} />
            <Route path="/admin/iframe-generator" element={<IFrameGenerator />} />
          </Route>
        </Route>
      </Route>

      {/* Taninmayan yol panoya doner. Eskiden bu sessizce oluyordu:
          `pathToTab` eslesmeyen her yol icin 'dashboard' donuyordu. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
