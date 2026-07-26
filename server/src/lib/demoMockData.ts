import type { FastifyReply, FastifyRequest } from 'fastify';

const DEMO_USERNAME = 'demo.musteri';

const now = new Date();
const iso = (daysAgo = 0, hour = 12) => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
};

const players = [
  { Id: 810001, Login: 'demo_ali', FirstName: 'Ali', LastName: 'Yilmaz', Email: 'ali.demo@example.com', MobilePhone: '+90 532 000 10 01', City: 'Istanbul', Balance: 18450, TotalDeposit: 145000, TotalWithdraw: 62000, BTag: 'AFF-IST', LastLoginIp: '88.245.10.11' },
  { Id: 810002, Login: 'demo_eda', FirstName: 'Eda', LastName: 'Kara', Email: 'eda.demo@example.com', MobilePhone: '+90 533 000 10 02', City: 'Ankara', Balance: 8200, TotalDeposit: 74000, TotalWithdraw: 28500, BTag: 'TG-SPORT', LastLoginIp: '78.180.22.44' },
  { Id: 810003, Login: 'demo_mert', FirstName: 'Mert', LastName: 'Akin', Email: 'mert.demo@example.com', MobilePhone: '+90 534 000 10 03', City: 'Izmir', Balance: 42100, TotalDeposit: 212000, TotalWithdraw: 92000, BTag: 'VIP-TR', LastLoginIp: '88.245.10.11' },
  { Id: 810004, Login: 'demo_sel', FirstName: 'Selin', LastName: 'Demir', Email: 'selin.demo@example.com', MobilePhone: '+90 535 000 10 04', City: 'Bursa', Balance: 3900, TotalDeposit: 36500, TotalWithdraw: 12000, BTag: null, LastLoginIp: '95.12.42.78' },
  { Id: 810005, Login: 'demo_can', FirstName: 'Can', LastName: 'Oz', Email: 'can.demo@example.com', MobilePhone: '+90 536 000 10 05', City: 'Antalya', Balance: 12600, TotalDeposit: 98000, TotalWithdraw: 41000, BTag: 'YT-CANLI', LastLoginIp: '176.42.17.9' },
  { Id: 810006, Login: 'demo_buse', FirstName: 'Buse', LastName: 'Arslan', Email: 'buse.demo@example.com', MobilePhone: '+90 537 000 10 06', City: 'Adana', Balance: 6750, TotalDeposit: 56000, TotalWithdraw: 18000, BTag: 'AFF-IST', LastLoginIp: '85.105.77.31' },
].map((player, index) => ({
  ...player,
  PartnerName: 'Hugsbet Demo',
  PartnerId: 18773823,
  CurrencyId: 'TRY',
  CreatedLocalDate: iso(45 + index * 7, 10),
  LastLoginLocalDate: iso(index, 18 - index),
  FirstDepositDateLocal: iso(40 + index * 6, 13),
  LastDepositDateLocal: iso(index + 1, 16),
  IsLocked: index === 3,
  IsVerified: index !== 3,
  IsTest: false,
  Status: index === 3 ? 'Risk izleme' : 'Dogrulandi',
  RegistrationIp: player.LastLoginIp,
  Phone: player.MobilePhone,
}));

const bonuses = [
  { Id: 250, Name: '250₺ Slot Deneme Bonusu', TypeId: 1, ProductTypeId: 1, ExternalId: 250, PlayersCount: 1420, IsDisabled: false, Category: 'Hediye Bonuslar' },
  { Id: 1001, Name: '%100 Risksiz İlk Yatırım', TypeId: 1, ProductTypeId: 1, ExternalId: 1001, PlayersCount: 890, IsDisabled: false, Category: 'Yatırım Bonusları' },
  { Id: 1002, Name: 'İlk Yatırımına 2 Katıyla Başla', TypeId: 1, ProductTypeId: 1, ExternalId: 1002, PlayersCount: 650, IsDisabled: false, Category: 'Yatırım Bonusları' },
  { Id: 1003, Name: '%20 Casino Yatırım Bonusu', TypeId: 1, ProductTypeId: 1, ExternalId: 1003, PlayersCount: 1120, IsDisabled: false, Category: 'Yatırım Bonusları' },
  { Id: 1004, Name: '%15 Spor Yatırım Bonusu', TypeId: 1, ProductTypeId: 1, ExternalId: 1004, PlayersCount: 940, IsDisabled: false, Category: 'Spor' },
  { Id: 1005, Name: '%30 Kayıp Bonusu', TypeId: 2, ProductTypeId: 1, ExternalId: 1005, PlayersCount: 2310, IsDisabled: false, Category: 'Kayıp Bonusları' },
  { Id: 1006, Name: 'Her Yatırıma Freespin', TypeId: 2, ProductTypeId: 2, ExternalId: 1006, PlayersCount: 1850, IsDisabled: false, Category: 'Hediye Bonuslar' },
  { Id: 1007, Name: '%400 Çarşamba Happy Days', TypeId: 1, ProductTypeId: 1, ExternalId: 1007, PlayersCount: 740, IsDisabled: false, Category: 'Yatırım Bonusları' },
  { Id: 1008, Name: '%5 Haftalık Kayıp Bonusu', TypeId: 2, ProductTypeId: 3, ExternalId: 1008, PlayersCount: 520, IsDisabled: false, Category: 'Kayıp Bonusları' },
  { Id: 1009, Name: "4. Yatırımın Patron'dan Hediye!", TypeId: 1, ProductTypeId: 1, ExternalId: 1009, PlayersCount: 380, IsDisabled: false, Category: 'Hediye Bonuslar' },
  { Id: 1010, Name: 'Medellin Şans Çarkı', TypeId: 3, ProductTypeId: 2, ExternalId: 1010, PlayersCount: 3100, IsDisabled: false, Category: 'Hediye Bonuslar' },
  { Id: 1011, Name: 'Doğum Günü Bonusu', TypeId: 1, ProductTypeId: 1, ExternalId: 1011, PlayersCount: 290, IsDisabled: false, Category: 'Hediye Bonuslar' }
];

const kpiFor = (clientId: number) => {
  const player = players.find((item) => item.Id === clientId) || players[0];
  const deposit = Number(player.TotalDeposit || 0);
  const withdrawal = Number(player.TotalWithdraw || 0);
  return {
    Id: clientId,
    ClientId: clientId,
    Name: `${player.FirstName} ${player.LastName}`,
    Login: player.Login,
    TotalSportBets: 84,
    TotalUnsettledBets: 6,
    TotalSportStakes: Math.round(deposit * 0.46),
    TotalUnsettledStakes: 8200,
    TotalSportWinnings: Math.round(deposit * 0.31),
    TotalCasinoStakes: Math.round(deposit * 1.2),
    TotalCasinoWinnings: Math.round(deposit * 0.92),
    SportProfitness: 18.4,
    CasinoProfitness: 11.6,
    TotalDeposit: deposit,
    TotalWithdrawal: withdrawal,
    ProfitAndLose: deposit - withdrawal,
    GamingProfitAndLose: Math.round(deposit * 0.24),
    LastSportBetTimeLocal: iso(1, 20),
    LastCasinoBetTimeLocal: iso(0, 19),
    DepositAmount: deposit,
    DepositCount: 14,
    FirstDepositTimeLocal: player.FirstDepositDateLocal,
    LastDepositTimeLocal: player.LastDepositDateLocal,
    WithdrawalCount: 5,
    WithdrawalAmount: withdrawal,
    LastWithdrawalTimeLocal: iso(3, 15),
    CurrencyId: 'TRY',
    BTag: player.BTag,
    LastDepositAmount: 7500,
    LastWithdrawalAmount: 5000,
    IsTest: false,
    IsVerified: player.IsVerified,
  };
};

function ok<T>(data: T) {
  return { HasError: false, AlertType: 'success', AlertMessage: null, ModelErrors: [], Data: data };
}

function pagedObjects(objects: any[], count = objects.length) {
  return { HasError: false, AlertType: 'success', AlertMessage: null, ModelErrors: [], Data: { Count: count, Objects: objects } };
}

function filterPlayers(body: any = {}) {
  let rows = [...players];
  if (body.Id) rows = rows.filter((item) => String(item.Id) === String(body.Id));
  if (body.Login) rows = rows.filter((item) => item.Login.toLowerCase().includes(String(body.Login).toLowerCase()));
  if (body.BTag) rows = rows.filter((item) => String(item.BTag || '').toLowerCase().includes(String(body.BTag).toLowerCase()));
  const skip = Number(body.SkeepRows || 0);
  const take = Number(body.MaxRows || rows.length || 20);
  return pagedObjects(rows.slice(skip, skip + take), rows.length);
}

function demoBetReport() {
  const rows = players.slice(0, 5).map((player, index) => ({
    Id: 910000 + index,
    PartnerId: 18773823,
    DocumentId: 770000 + index,
    Type: index % 2 ? 2 : 1,
    TypeName: index % 2 ? 'Kombine' : 'Tekli',
    Amount: [2500, 1400, 5200, 900, 3200][index],
    WinningAmount: [4100, 0, 7800, 1800, 0][index],
    PossibleWin: [4100, 5900, 7800, 1800, 12400][index],
    Price: [1.64, 4.2, 1.5, 2, 3.8][index],
    CurrencyId: 'TRY',
    State: index % 3 === 1 ? 2 : 1,
    StateName: index % 3 === 1 ? 'Kaybetti' : 'Kazandi',
    CreatedLocal: iso(index, 18),
    ClientId: player.Id,
    ClientLogin: player.Login,
    ClientName: `${player.FirstName} ${player.LastName}`,
    ClientFirstName: player.FirstName,
    ClientLastName: player.LastName,
    IsLive: index % 2 === 0,
    BTag: player.BTag,
    SelectionCount: index % 2 ? 3 : 1,
    BetSelections: [],
  }));
  return { HasError: false, Data: { BetReportSettings: {}, BetData: { Count: rows.length, Objects: rows } } };
}

function demoSelections() {
  return ok([
    { BetId: 910000, SelectionId: 1, Price: 1.64, State: 1, StateName: 'Kazandi', HomeTeamName: 'Galatasaray', AwayTeamName: 'Fenerbahce', CompetitionName: 'Super Lig', MarketName: 'Mac Sonucu', SelectionName: '1', MatchName: 'Galatasaray - Fenerbahce', StartTimeLocal: iso(1, 20), SportName: 'Futbol' },
    { BetId: 910000, SelectionId: 2, Price: 2.1, State: 1, StateName: 'Kazandi', HomeTeamName: 'Arsenal', AwayTeamName: 'Chelsea', CompetitionName: 'Premier League', MarketName: 'Toplam Gol', SelectionName: '2.5 Ust', MatchName: 'Arsenal - Chelsea', StartTimeLocal: iso(2, 18), SportName: 'Futbol' },
  ]);
}

export function isDemoUser(request: FastifyRequest) {
  return (request as any).session?.user?.username === DEMO_USERNAME;
}

export async function maybeSendDemoMock(request: FastifyRequest, reply: FastifyReply) {
  if (!isDemoUser(request)) return false;

  const method = request.method.toUpperCase();
  const path = request.url.split('?')[0];
  const body = (request as any).body || {};
  const query = (request as any).query || {};

  const send = (payload: any) => {
    reply.header('x-demo-data', 'true').send(payload);
    return true;
  };

  if (method !== 'GET' && ['/api/admin/games/config', '/api/admin/forms/settings', '/api/admin/tournaments/settings', '/api/admin/rules', '/api/admin/promos/overrides'].includes(path)) {
    return send({ ok: true, demo: true });
  }

  if (method === 'POST' && ['/api/admin/bonus/charge', '/api/admin/manual-adjustment', '/api/sms/send', '/api/admin/forms/update', '/api/admin/forms/delete'].includes(path)) {
    return send({ ok: true, demo: true, HasError: false, AlertMessage: 'Demo modunda islem simule edildi.' });
  }

  switch (path) {
    case '/api/summary':
      return send(ok({ Deposits: 1248500, DepositCount: 286, Withdrawals: 548200, WithdrawalCount: 74, PlayersLoggedIn: 312, PlayersRegistered: 128, Profit: 700300, PlayersBalance: 426900, PlayersBonusBalance: 84500, CorrectionsUp: 12500, CorrectionsDown: 4200, DepositClientCount: 96, WithdrawalClientCount: 38, TournamentCost: 32000, LoginCount: 892 }));
    case '/api/partner-profit':
    case '/api/partner-profit-details':
      return send(ok({ SportTurnover: 842000, SportWinning: 628000, CasinoTurnover: 1675000, CasinoWinning: 1298000, Rake: 18500, TournamentCost: 32000, Bonus: 74500 }));
    case '/api/top-sports':
      return send(ok([
        { SportId: 1, Name: 'Futbol', Turnover: 612000, WinningAmount: 448000, ProfitAmount: 164000 },
        { SportId: 2, Name: 'Basketbol', Turnover: 138000, WinningAmount: 102500, ProfitAmount: 35500 },
        { SportId: 3, Name: 'Tenis', Turnover: 92000, WinningAmount: 77500, ProfitAmount: 14500 },
      ]));
    case '/api/top-casino-games':
      return send(ok([
        { GameId: 11, Name: 'Sweet Bonanza', Turnover: 425000, WinningAmount: 338000, ProfitAmount: 87000 },
        { GameId: 12, Name: 'Gates of Olympus', Turnover: 389000, WinningAmount: 312000, ProfitAmount: 77000 },
        { GameId: 13, Name: 'Aviator', Turnover: 252000, WinningAmount: 219000, ProfitAmount: 33000 },
      ]));
    case '/api/sportbook-overview':
      return send(ok({ Details: [{ IsLive: false, Turnover: 524000, WinningAmount: 381000, UnsettledBetsAmount: 42000, NumberOfBets: 820, NumberOfPlayers: 142, AverageBetAmount: 639, GGR: 143000, Profitness: 27.2, BetPerPlayer: 5.7, SingleBetCount: 510, MultipleBetCount: 260, SystemBetCount: 32, ChainBetCount: 18 }, { IsLive: true, Turnover: 318000, WinningAmount: 247000, UnsettledBetsAmount: 26000, NumberOfBets: 610, NumberOfPlayers: 96, AverageBetAmount: 521, GGR: 71000, Profitness: 22.3, BetPerPlayer: 6.3, SingleBetCount: 382, MultipleBetCount: 190, SystemBetCount: 24, ChainBetCount: 14 }], BetCountsPerType: { Single: 892, Multiple: 450, System: 56, Chain: 32 } }));
    case '/api/clients':
      return send(filterPlayers(body));
    case '/api/clients-by-ip':
      return send(pagedObjects(players.filter((item) => item.LastLoginIp === (body.LoginIP || players[0].LastLoginIp))));
    case '/api/client-kpi':
      return send(ok(kpiFor(Number(query.id || body.ClientId || players[0].Id))));
    case '/api/client-notes':
      return send(ok([{ Id: 1, ClientId: body.ClientId, Type: 1, TypeName: 'Operasyon', Note: 'Demo notu: VIP aday segmentinde takip ediliyor.', CreatedLocal: iso(2, 11), CreatedBy: 'demo.musteri', ModifiedLocal: null, ModifiedBy: null }]));
    case '/api/client-bonuses':
      return send(ok([{ Id: 7101, ClientId: body.ClientId, PartnerBonusId: 501, ResultType: 1, ResultDateLocal: iso(3, 14), Name: 'Demo %100 Hos Geldin Bonusu', Amount: 2500, CreatedLocal: iso(5, 14), WageredAmount: 8200, ToWagerAmount: 15000, PaidAmount: 0, WinAmount: 1200, RealAmount: 2500, ClientCurrency: 'TRY' }]));
    case '/api/client-transactions':
    case '/api/client-profile-transactions':
      return send(pagedObjects([
        { Id: 6101, DocumentId: 6101, ClientId: body.ClientId || 810001, ClientLogin: 'demo_ali', ClientName: 'Ali Yilmaz', TypeId: 1, TypeName: 'Yatirim', DocumentTypeName: 'Yatirim', Amount: 7500, CurrencyId: 'TRY', CreatedLocal: iso(1, 16), TransactionDate: iso(1, 16), PaymentSystemName: 'Papara', UserName: 'demo.musteri', State: 1, StateName: 'Onaylandi', Balance: 18450, Operation: 1 },
        { Id: 6102, DocumentId: 6102, ClientId: body.ClientId || 810001, ClientLogin: 'demo_ali', ClientName: 'Ali Yilmaz', TypeId: 2, TypeName: 'Cekim', DocumentTypeName: 'Cekim', Amount: -2500, CurrencyId: 'TRY', CreatedLocal: iso(2, 13), TransactionDate: iso(2, 13), PaymentSystemName: 'Banka', UserName: 'finance.demo', State: 1, StateName: 'Odendi', Balance: 10950, Operation: -1 },
      ], 2));
    case '/api/client-detailed-report':
      return send(ok([{ ClientId: body.ClientId || 810001, ClientName: 'Ali Yilmaz', Login: 'demo_ali', CurrencyId: 'TRY', RegistrationDate: iso(50), RegistrationDateLocal: iso(50), SportsbookProfileId: 1, CurrentBalance: 18450, BTag: 'AFF-IST', SportBetAmount: 62000, SportBetCount: 84, CasinoBetAmount: 174000, CasinoBetCount: 310, DepositAmount: 145000, DepositCount: 14, WithdrawalAmount: 62000, WithdrawalCount: 5, NetProfit: 83000, IsVerified: true }]));
    case '/api/withdrawal-requests':
      return send({ HasError: false, Data: { Count: 4, TotalAmount: 548200, ClientRequests: [
        { Id: 9001, ClientId: 810003, ClientLogin: 'demo_mert', ClientName: 'Mert Akin', ClientFirstName: 'Mert', ClientLastName: 'Akin', Amount: 125000, AmountEUR: 3550, CurrencyId: 'TRY', State: 1, StateName: 'Onay bekliyor', RequestTimeLocal: iso(0, 15), PaymentSystemName: 'Banka Havalesi', Notes: 'VIP cekim', Info: 'Risk temiz', AllowUserName: null, RejectReason: null },
        { Id: 9002, ClientId: 810002, ClientLogin: 'demo_eda', ClientName: 'Eda Kara', ClientFirstName: 'Eda', ClientLastName: 'Kara', Amount: 28500, AmountEUR: 810, CurrencyId: 'TRY', State: 2, StateName: 'Odendi', RequestTimeLocal: iso(1, 12), PaymentSystemName: 'Papara', Notes: '', Info: '', AllowUserName: 'finance.demo', RejectReason: null },
        { Id: 9003, ClientId: 810004, ClientLogin: 'demo_sel', ClientName: 'Selin Demir', ClientFirstName: 'Selin', ClientLastName: 'Demir', Amount: 12000, AmountEUR: 340, CurrencyId: 'TRY', State: 3, StateName: 'Reddedildi', RequestTimeLocal: iso(2, 17), PaymentSystemName: 'Banka', Notes: 'Evrak bekleniyor', Info: '', AllowUserName: null, RejectReason: 'KYC eksik' },
      ] } });
    case '/api/deposits':
      return send({ HasError: false, Data: { TotalAmount: 1248500, Documents: { Count: 5, Objects: players.slice(0, 5).map((player, index) => ({ Id: 8000 + index, PartnerId: 18773823, TypeId: 1, CurrencyId: 'TRY', Amount: [7500, 12000, 50000, 3500, 18500][index], ExchangedAmount: [7500, 12000, 50000, 3500, 18500][index], TransactionDate: iso(index, 16), CreatedLocal: iso(index, 16), ModifiedLocal: iso(index, 16), SessionId: 1, Note: 'Demo yatirim', State: 1, ClientId: player.Id, PaymentSystemId: 1, PaymentSystemName: index % 2 ? 'Papara' : 'Havale', ClientName: `${player.FirstName} ${player.LastName}`, ClientLogin: player.Login, TypeName: 'Yatirim', UserName: 'finance.demo' })) } } });
    case '/api/bonuses':
    case '/api/admin/bonus/partner-list':
      return send({ Result: bonuses.map((bonus) => ({ ...bonus, Type: { Id: bonus.TypeId, Name: 'Bonus' }, Partner: { Id: 18773823, Name: 'Hugsbet Demo' }, BeginDate: iso(30), EndDate: iso(-30), Description: bonus.Name, MaxplayersCount: 1000, IsVisibleForAllplayers: true })), HasError: false, ErrorDescription: null, ErrorId: 0, Count: bonuses.length, Data: bonuses });
    case '/api/freebet-bonuses':
      return send({ HasError: false, Data: { Count: 2, Objects: [{ Id: 601, BonusId: 601, PartnerId: 18773823, Name: 'Demo 250 TL Freebet', Description: 'Spor demo freebet', MinSelCount: 1, MinSelPrice: 1.4, MaxSelPrice: null, MinBetPrice: null, LiveOrPreMatch: 0, AllowedWithSP: true, ExpirationDays: 7, Note: null, StartDateLocal: iso(10), EndDateLocal: iso(-20), IsDeleted: false }, { Id: 602, BonusId: 602, PartnerId: 18773823, Name: 'Demo Derbi Freebet', Description: 'Derbi kampanyasi', MinSelCount: 2, MinSelPrice: 1.3, MaxSelPrice: null, MinBetPrice: null, LiveOrPreMatch: 0, AllowedWithSP: true, ExpirationDays: 3, Note: null, StartDateLocal: iso(2), EndDateLocal: iso(-5), IsDeleted: false }] } });
    case '/api/promos/auto':
    case '/api/promos/list':
      return send({
        HasError: false,
        Data: {
          fetchedAt: new Date().toISOString(),
          source: 'Lynon Bonus Engine V2',
          promotions: bonuses.map((bonus) => ({
            id: bonus.Id,
            backofficeId: bonus.Id,
            platformBonusDefinitionId: bonus.Id,
            promoTitle: bonus.Name,
            image: '',
            detailHtml: `<div class="space-y-2"><p class="font-bold text-white">${bonus.Name}</p><p class="text-[#d4af37]">Lynon panelinde otomasyon kurallarıyla tanımlanmıştır.</p></div>`,
            tags: [bonus.Category, 'Aktif'],
            rules: {
              externalId: bonus.Id,
              enabled: true,
              narcosBonusCategory: bonus.Category,
              minDeposit: bonus.Id === 250 ? 0 : 500
            }
          }))
        }
      });
    case '/api/bet-report':
    case '/api/site-bet-history':
    case '/api/client-bet-history':
      return send(demoBetReport());
    case '/api/bet-selections':
    case '/api/client-bet-selections-history':
      return send(demoSelections());
    case '/api/registration-stats':
      return send(ok(Array.from({ length: 7 }).map((_, index) => ({ DateLocal: iso(6 - index).slice(0, 10), RegisteredClientsCount: 12 + index * 3, DepositedClientsCount: 7 + index, DepositsCount: 18 + index * 2, DepositsAmount: 42000 + index * 8500, ConvertionRate: 58 + index, AverageAmount: 2450 + index * 120 }))));
    case '/api/registration-stats-details':
      return send(ok(players.map((player, index) => ({ ClientId: player.Id, PartnerId: 18773823, Created: player.CreatedLocalDate, CreatedLocal: player.CreatedLocalDate, FirstDepositTime: player.FirstDepositDateLocal, FirstDepositTimeLocal: player.FirstDepositDateLocal, LastDepositTime: player.LastDepositDateLocal, LastDepositTimeLocal: player.LastDepositDateLocal, DepositCount: 3 + index, DepositAmount: player.TotalDeposit, DepositAmountInRC: player.TotalDeposit, DepositAverageAmount: Math.round(Number(player.TotalDeposit) / (3 + index)), DepositAverageAmountInRC: Math.round(Number(player.TotalDeposit) / (3 + index)), Login: player.Login, Name: `${player.FirstName} ${player.LastName}`, CurrencyId: 'TRY', BTag: player.BTag }))));
    case '/api/provider-report':
      return send({ Result: { TotalCount: 4, TotalWinCount: 720, TotalRound: 14250, TotalBetAmountByReportCurrency: 1675000, TotalWinAmountByReportCurrency: 1298000, TotalProfitByReportCurrency: 377000, TotalRakeWinAmountByReportCurrency: null, TotalRakeBetAmountByReportCurrency: null, TotalRakeByReportCurrency: null, TotalBonusByReportCurrency: 74500, TotalTipByReportCurrency: 0, TotalTaxByReportCurrency: 0, TotalBankByReportCurrency: 0, TotalFreeSpinWinAmountByReportCurrency: 18500, TotalJackpotWinAmountByReportCurrency: 0, TotalTournamentWinAmountByReportCurrency: 32000, TotalCashbackBonusAmountByReportCurrency: 12500, ReportByTResultViewModel: ['Pragmatic Play', 'Evolution', 'Aviator', 'EGT'].map((name, index) => ({ PartnerId: 18773823, CurrencyId: 'TRY', BetAmount: [425000, 388000, 252000, 198000][index], WinAmount: [338000, 301000, 219000, 150000][index], Profit: [87000, 87000, 33000, 48000][index], RakeWinAmount: 0, RakeBetAmount: 0, Rake: 0, TicketAmount: 0, ProviderPrefix: name.slice(0, 3).toUpperCase(), ProviderName: name, BetAmountByReportCurrency: [425000, 388000, 252000, 198000][index], WinAmountByReportCurrency: [338000, 301000, 219000, 150000][index], ProfitByReportCurrency: [87000, 87000, 33000, 48000][index], RakeWinAmountByReportCurrency: 0, RakeBetAmountByReportCurrency: 0, RakeByReportCurrency: 0, TicketAmountByReportCurrency: 0, Round: [4200, 1900, 5300, 2850][index] })) }, HasError: false, ErrorId: 0, ErrorDescription: null });
    case '/api/client-bonus-report':
      return send({ HasError: false, Data: { Count: 3, Objects: bonuses.map((bonus, index) => ({ ClientId: players[index].Id, ClientLogin: players[index].Login, Name: bonus.Name, Amount: [2500, 500, 250][index], CreatedLocal: iso(index + 1), ResultType: 1, WageredAmount: [8200, 2100, 900][index], ToWagerAmount: [15000, 3000, 1200][index], WinAmount: [1200, 0, 450][index] })) } });
    case '/api/admin/live-alerts':
      return send({ HasError: false, anomalies: [{ type: 'large_deposit', clientId: 810003, clientLogin: 'demo_mert', message: 'Son 24 saatte yuksek yatirim aktivitesi', severity: 'medium', value: 50000, date: iso(0, 16) }, { type: 'same_ip', clientId: 810001, clientLogin: 'demo_ali', message: 'Ayni IP uzerinden iki hesap girisi', severity: 'low', date: iso(0, 18) }], summary: { totalProcessed: 96, uniqueClients: 72, anomalyCount: 2, dateRange: { from: iso(1), to: iso(0) } } });
    case '/api/admin/intelligence/clusters':
      return send({ HasError: false, clusters: [{ id: 'cluster-demo-1', risk: 'medium', reason: 'Ayni IP ve benzer cihaz izi', players: [players[0], players[2]], score: 68 }] });
    case '/api/admin/intelligence/business-insights':
      return send({ HasError: false, insights: [{ title: 'Spor hacmi artiyor', severity: 'positive', message: 'Futbol cirosu demo donemde %18 yukselis gosterdi.' }, { title: 'VIP segment firsati', severity: 'info', message: '3 oyuncu yuksek bakiye ve aktiflik sinyali veriyor.' }], summary: { revenue: 700300, trend: 12.4 } });
    case '/api/forms/settings':
      return send({ ok: true, data: { callReasons: ['Finansal islemler', 'Bonus islemleri', 'Hesap dogrulama'], partnershipTypes: ['Telegram grubu', 'Yayinci', 'Sosyal medya'], callActive: true, partnershipActive: true, callTitle: 'Beni Ara', callDescription: 'Demo arama talebi formu', callSuccessMessage: 'Demo talebiniz alindi.', callButtonText: 'Talep Gonder', partnershipTitle: 'Ortaklik Basvurusu', partnershipDescription: 'Demo partner basvurusu', partnershipSuccessMessage: 'Demo basvurunuz alindi.', partnershipButtonText: 'Basvuru Gonder' } });
    case '/api/admin/forms':
      return send({ ok: true, data: { callRequests: [{ id: 'call-demo-1', username: 'demo_eda', phone: '+90 533 000 10 02', reason: 'Bonus islemleri', status: 'pending', createdAt: iso(0, 14) }], partnershipRequests: [{ id: 'partner-demo-1', type: 'Telegram grubu', contact: '@demo_partner', channelUrl: 'https://t.me/demo', audienceSize: '12.000', message: 'Demo ortaklik basvurusu', status: 'pending', createdAt: iso(1, 11) }] } });
    case '/api/audit':
      return send({ data: [{ at: iso(0, 10), user: 'demo.musteri', role: 'manager', action: 'login' }, { at: iso(0, 11), user: 'demo.musteri', role: 'manager', action: 'demo_panel_view', resource: 'dashboard' }] });
    default:
      if (path.startsWith('/api/admin/intelligence/scorecard')) {
        return send({ HasError: false, scorecard: { score: 82, level: 'Guvenilir', risks: ['Ayni IP izleme'], positives: ['Duzgun yatirim gecmisi', 'KYC tamamlandi'] } });
      }
      return false;
  }
}
