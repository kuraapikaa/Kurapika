import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { dashboardApi, type DateRange } from '../api/client';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';

interface RegistrationStatsProps {
  dateRange: DateRange;
}

export function RegistrationStats({ dateRange }: RegistrationStatsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const rowsPerPage = 25;

  const statsQuery = useQuery({
    queryKey: ['registration-stats', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.registrationStats(dateRange),
    staleTime: 5 * 60 * 1000,
  });

  const detailsQuery = useQuery({
    queryKey: ['registration-stats-details', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.registrationStatsDetails(dateRange),
    staleTime: 5 * 60 * 1000,
  });

  const stats = statsQuery.data?.Data || [];
  const details = detailsQuery.data?.Data || [];
  const totalRegistered = stats.reduce((sum, row) => sum + row.RegisteredClientsCount, 0);
  const totalDeposited = stats.reduce((sum, row) => sum + row.DepositedClientsCount, 0);
  const totalDeposits = stats.reduce((sum, row) => sum + row.DepositsAmount, 0);
  const totalDepositCount = stats.reduce((sum, row) => sum + row.DepositsCount, 0);
  const conversionRate = totalRegistered > 0 ? (totalDeposited / totalRegistered) * 100 : 0;
  const averageDeposit = totalDepositCount > 0 ? totalDeposits / totalDepositCount : 0;

  const filteredDetails = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    if (!query) return details;
    return details.filter((player) =>
      player.Login?.toLocaleLowerCase('tr-TR').includes(query)
      || player.Name?.toLocaleLowerCase('tr-TR').includes(query)
      || String(player.ClientId).includes(query)
    );
  }, [details, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDetails.length / rowsPerPage));
  const paginatedDetails = filteredDetails.slice((playerPage - 1) * rowsPerPage, playerPage * rowsPerPage);
  const hasError = statsQuery.isError || detailsQuery.isError;

  return (
    <div className="registration-dashboard">
      <section className="registration-overview">
        <div>
          <span className="registration-kicker"><Sparkles size={12} /> Dönüşüm merkezi</span>
          <h2>Kayıttan yatırıma uzanan yolculuğu izle.</h2>
          <p>Yeni oyuncuların kayıt, ilk yatırım ve toplam değer performansını seçilen tarih aralığında karşılaştır.</p>
        </div>
        <div className="registration-range">
          <CalendarDays size={17} />
          <div>
            <span>Rapor aralığı</span>
            <strong>{formatDate(dateRange.startDate)} — {formatDate(dateRange.endDate)}</strong>
          </div>
        </div>
      </section>

      <section className="registration-stat-grid">
        <StatCard label="Toplam kayıt" value={formatNumber(totalRegistered)} icon={Users} tone="blue" isLoading={statsQuery.isLoading} helper="Yeni oyuncu hesabı" />
        <StatCard label="İlk yatırım yapan" value={formatNumber(totalDeposited)} icon={UserPlus} tone="emerald" isLoading={statsQuery.isLoading} helper={`%${conversionRate.toFixed(1)} dönüşüm`} />
        <StatCard label="Toplam yatırım" value={`${formatNumber(totalDeposits)} TRY`} icon={Wallet} tone="cyan" isLoading={statsQuery.isLoading} helper={`${formatNumber(totalDepositCount)} işlem`} />
        <StatCard label="Ortalama yatırım" value={`${formatNumber(averageDeposit)} TRY`} icon={TrendingUp} tone="amber" isLoading={statsQuery.isLoading} helper="İşlem başına değer" />
      </section>

      {hasError ? (
        <div className="registration-error">
          <CircleDollarSign size={24} />
          <div>
            <h3>Rapor verileri alınamadı.</h3>
            <p>Bağlantı veya yetkilendirme durumunu kontrol edip yeniden deneyin.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="registration-insight-grid">
            <div className="registration-panel">
              <PanelHeader icon={BarChart3} title="Günlük performans" description="Kayıt ve yatırım dönüşümünün gün bazlı görünümü" />
              {statsQuery.isLoading ? (
                <LoadingBlock label="Performans hazırlanıyor" />
              ) : stats.length === 0 ? (
                <EmptyAnalytics title="Bu tarih aralığında hareket yok" description="Yeni kayıt oluştuğunda günlük performans grafiği burada görünür." />
              ) : (
                <div className="registration-bars">
                  {stats.map((row, index) => {
                    const maxRegistered = Math.max(...stats.map((item) => item.RegisteredClientsCount), 1);
                    const registrationHeight = Math.max(8, (row.RegisteredClientsCount / maxRegistered) * 100);
                    const depositHeight = row.RegisteredClientsCount > 0
                      ? Math.max(5, (row.DepositedClientsCount / maxRegistered) * 100)
                      : 5;
                    return (
                      <div className="registration-bar-group" key={`${row.DateLocal}-${index}`}>
                        <div className="registration-bar-track">
                          <span className="registration-bar-registered" style={{ height: `${registrationHeight}%` }} />
                          <span className="registration-bar-deposited" style={{ height: `${depositHeight}%` }} />
                        </div>
                        <span>{new Date(row.DateLocal).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="registration-legend">
                <span><i className="bg-blue-400" /> Kayıt</span>
                <span><i className="bg-emerald-300" /> İlk yatırım</span>
              </div>
            </div>

            <div className="registration-panel">
              <PanelHeader icon={TrendingUp} title="Dönüşüm hunisi" description="Kayıtların yatırım adımlarındaki ilerleyişi" />
              <div className="registration-funnel">
                <FunnelStep label="Kayıt olan oyuncu" value={totalRegistered} percentage={100} tone="blue" />
                <FunnelStep label="Yatırım yapan oyuncu" value={totalDeposited} percentage={conversionRate} tone="emerald" />
                <FunnelStep label="Tekrar yatırım işlemi" value={totalDepositCount} percentage={totalDeposited > 0 ? Math.min(100, (totalDepositCount / totalDeposited) * 100) : 0} tone="violet" />
              </div>
              <div className="registration-highlight">
                <span>Oyuncu başına değer</span>
                <strong>{totalDeposited > 0 ? formatNumber(totalDeposits / totalDeposited) : '0'} TRY</strong>
                <p>Yatırım yapan kayıtlı oyuncu başına ortalama toplam tutar.</p>
              </div>
            </div>
          </section>

          <section className="registration-panel">
            <PanelHeader icon={BarChart3} title="Günlük özet" description={`${stats.length} günlük performans kaydı`} />
            <div className="overflow-x-auto">
              <table className="registration-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th className="text-right">Kayıt</th>
                    <th className="text-right">Yatırımcı</th>
                    <th className="text-right">İşlem</th>
                    <th className="text-right">Yatırım</th>
                    <th className="text-right">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {statsQuery.isLoading ? (
                    <tr><td colSpan={6}><LoadingBlock label="Günlük veriler yükleniyor" compact /></td></tr>
                  ) : stats.length === 0 ? (
                    <tr><td colSpan={6}><EmptyTable label="Seçilen tarih aralığında günlük veri bulunamadı." /></td></tr>
                  ) : stats.map((row, index) => (
                    <tr key={`${row.DateLocal}-${index}`}>
                      <td><strong>{new Date(row.DateLocal).toLocaleDateString('tr-TR')}</strong></td>
                      <td className="text-right">{formatNumber(row.RegisteredClientsCount)}</td>
                      <td className="text-right text-emerald-300">{formatNumber(row.DepositedClientsCount)}</td>
                      <td className="text-right">{formatNumber(row.DepositsCount)}</td>
                      <td className="text-right font-semibold text-cyan-200">{formatNumber(row.DepositsAmount)} TRY</td>
                      <td className="text-right"><span className="registration-rate">%{row.ConvertionRate.toFixed(1)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="registration-panel">
            <div className="registration-player-header">
              <PanelHeader icon={Users} title="Yeni oyuncular" description={`${filteredDetails.length} kayıt listeleniyor`} />
              <label className="registration-search">
                <Search size={15} />
                <input
                  value={searchTerm}
                  onChange={(event) => { setSearchTerm(event.target.value); setPlayerPage(1); }}
                  placeholder="ID, kullanıcı veya isim ara"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="registration-table registration-player-table">
                <thead>
                  <tr>
                    <th>Oyuncu</th>
                    <th>Kayıt tarihi</th>
                    <th>İlk yatırım</th>
                    <th className="text-right">İşlem sayısı</th>
                    <th>BTag</th>
                    <th className="text-right">Toplam yatırım</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsQuery.isLoading ? (
                    <tr><td colSpan={6}><LoadingBlock label="Oyuncular yükleniyor" compact /></td></tr>
                  ) : paginatedDetails.length === 0 ? (
                    <tr><td colSpan={6}><EmptyTable label={searchTerm ? 'Aramana uygun kayıt bulunamadı.' : 'Seçilen aralıkta oyuncu kaydı bulunamadı.'} /></td></tr>
                  ) : paginatedDetails.map((player) => (
                    <tr key={player.ClientId}>
                      <td>
                        <Link to={`/oyuncu/${player.ClientId}/${player.Login}`} className="registration-player">
                          <span>{player.Login?.slice(0, 2).toUpperCase()}</span>
                          <div><strong>{player.Login}</strong><small>#{player.ClientId} · {player.Name}</small></div>
                        </Link>
                      </td>
                      <td>{formatDateTime(player.CreatedLocal)}</td>
                      <td>{player.FirstDepositTimeLocal ? <span className="text-emerald-300">{formatDateTime(player.FirstDepositTimeLocal)}</span> : <span className="text-slate-700">Henüz yok</span>}</td>
                      <td className="text-right font-semibold text-white">{formatNumber(player.DepositCount)}</td>
                      <td>{player.BTag ? <span className="registration-btag">{player.BTag}</span> : <span className="text-slate-700">—</span>}</td>
                      <td className="text-right">
                        <strong className={player.DepositAmount > 0 ? 'text-emerald-300' : 'text-slate-600'}>
                          {formatNumber(player.DepositAmount)} {player.CurrencyId}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDetails.length > rowsPerPage && (
              <div className="registration-pagination">
                <span>{(playerPage - 1) * rowsPerPage + 1}–{Math.min(playerPage * rowsPerPage, filteredDetails.length)} / {filteredDetails.length}</span>
                <div>
                  <button type="button" onClick={() => setPlayerPage((page) => Math.max(1, page - 1))} disabled={playerPage === 1}><ChevronLeft size={17} /></button>
                  <strong>{playerPage} / {totalPages}</strong>
                  <button type="button" onClick={() => setPlayerPage((page) => Math.min(totalPages, page + 1))} disabled={playerPage === totalPages}><ChevronRight size={17} /></button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  helper,
  isLoading,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  helper: string;
  isLoading: boolean;
}) {
  return (
    <div className="registration-stat-card">
      <span className={cn('registration-stat-icon', `registration-tone-${tone}`)}><Icon size={19} /></span>
      <div>
        <span>{label}</span>
        {isLoading ? <i /> : <strong>{value}</strong>}
        <small>{helper}</small>
      </div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="registration-panel-header">
      <span><Icon size={17} /></span>
      <div><h3>{title}</h3><p>{description}</p></div>
    </div>
  );
}

function FunnelStep({ label, value, percentage, tone }: { label: string; value: number; percentage: number; tone: string }) {
  return (
    <div className="registration-funnel-step">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
      </div>
      <div><i className={`registration-funnel-${tone}`} style={{ width: `${Math.max(4, Math.min(100, percentage))}%` }} /></div>
      <small>%{percentage.toFixed(1)}</small>
    </div>
  );
}

function LoadingBlock({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={cn('registration-loading', compact && 'is-compact')}>
      <Loader2 size={22} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function EmptyAnalytics({ title, description }: { title: string; description: string }) {
  return (
    <div className="registration-empty-analytics">
      <span><BarChart3 size={22} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="registration-empty-lines"><i /><i /><i /><i /><i /></div>
    </div>
  );
}

function EmptyTable({ label }: { label: string }) {
  return (
    <div className="registration-empty-table">
      <UserPlus size={20} />
      <span>{label}</span>
      <ArrowRight size={15} />
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('tr-TR')} · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}
