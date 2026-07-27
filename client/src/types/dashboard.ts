export interface ApiResponse<T> {
  Data: T;
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  Message?: string | null;
  ModelErrors?: unknown;
}

export interface SummaryData {
  Deposits: number;
  DepositCount: number;
  Withdrawals: number;
  WithdrawalCount: number;
  PlayersLoggedIn: number;
  PlayersRegistered: number;
  Profit: number;
  PlayersBalance: number;
  PlayersBonusBalance: number;
  CorrectionsUp: number;
  CorrectionsDown: number;
  DepositClientCount: number;
  WithdrawalClientCount: number;
  TournamentCost: number;
  LoginCount: number;
}

export interface PartnerProfitData {
  SportTurnover: number | null;
  SportWinning: number | null;
  CasinoTurnover: number | null;
  CasinoWinning: number | null;
  Rake: number | null;
  TournamentCost: number | null;
  Bonus: number | null;
}

export interface TopSportItem {
  SportId: number;
  Name: string;
  Turnover: number;
  WinningAmount: number;
  ProfitAmount: number;
}

export interface TopCasinoGameItem {
  GameId: number;
  Name: string;
  Turnover: number;
  WinningAmount: number;
  ProfitAmount: number;
}

export interface SportbookDetailRow {
  IsLive: boolean | null;
  Turnover: number;
  WinningAmount: number;
  UnsettledBetsAmount: number;
  NumberOfBets: number;
  NumberOfPlayers: number;
  AverageBetAmount: number;
  GGR: number;
  Profitness: number;
  BetPerPlayer: number;
  SingleBetCount: number;
  MultipleBetCount: number;
  SystemBetCount: number;
  ChainBetCount: number;
}

export interface BetCountsPerType {
  Single: number;
  Multiple: number;
  System: number;
  Chain: number;
}

export interface SportbookOverviewData {
  Details: SportbookDetailRow[];
  BetCountsPerType: BetCountsPerType;
}

// Bonus / Promosyon listesi API
export interface BonusTypeRef {
  Id: number;
  Name: string;
}

export interface BonusPartnerRef {
  Id: number;
  Name: string;
}

export interface FreeSpinDefinition {
  BonusDefinitionId: number;
  FreeSpinsMinCount: number;
  FreeSpinsMaxCount: number;
  FreeSpinsTotalCount: number;
  BetLevel: number;
  WageringFactor: number;
  CurrentAwardedSpins?: number;
  BuyBonus?: boolean;
  IsConvertible?: boolean;
}

export interface DepositDefinition {
  BonusDefinitionId: number;
  BonusWFactor?: number;
  DepositWFactor?: number;
  MaxPayoutPercentage?: number;
  WageringPercentage?: number | null;
  SuppressWithdrawal?: boolean;
}

export interface BonusListItem {
  Type: BonusTypeRef;
  ProductTypeId: number;
  TypeId: number;
  BonusCategory?: string;
  IsFreeBet?: boolean;
  SourceType?: 'Campaign' | 'Offer';
  ExternalId: number;
  SessionId: string;
  Partner: BonusPartnerRef;
  BeginDate: string;
  EndDate: string;
  ExpirationDays: number;
  Description: string;
  Note?: string | null;
  MaxplayersCount: number;
  IsVisibleForAllplayers: boolean;
  IsDisabled: boolean;
  PlayersCount: number | null;
  IsAvailableForBonusRequest?: boolean;
  FreeSpinDefinition?: FreeSpinDefinition;
  DepositDefinition?: DepositDefinition;
  SyncedWithPlatform?: boolean;
  SyncedWithProvider?: boolean;
  Id: number;
  Name: string;
}

export interface BonusListResponse {
  Result: BonusListItem[];
  HasError: boolean;
  ErrorDescription: string | null;
  ErrorId: number;
  Count: number;
}

// FreeBet bonusları (GetFreeBetBonusesByFilter)
export interface FreeBetBonusItem {
  Id: number;
  BonusId: number;
  PartnerId: number;
  NameId?: number;
  DescriptionId?: number;
  Name: string;
  Description: string;
  MinSelCount: number;
  MinSelPrice: number;
  MaxSelPrice: number | null;
  MinBetPrice: number | null;
  LiveOrPreMatch: number;
  AllowedWithSP: boolean;
  ExpirationDays: number;
  Note: string | null;
  StartDateLocal: string;
  EndDateLocal: string;
  IsDeleted: boolean;
  PartnerBonus?: unknown;
  SportBonusRules?: unknown[];
}

export interface FreeBetBonusResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data: {
    Count: number;
    Objects: FreeBetBonusItem[];
  };
}

// Bütün oyuncular (GetClients) – API yanıtındaki tüm alanlar
export interface ClientItem {
  Id: number;
  Login: string;
  FirstName: string | null;
  LastName: string | null;
  MiddleName?: string | null;
  NickName?: string | null;
  Email: string | null;
  Phone: string | null;
  MobilePhone: string | null;
  PersonalId?: string | null;
  Address?: string | null;
  City?: string | null;
  ZipCode?: string | null;
  BirthDate?: string | null;
  PartnerName: string | null;
  PartnerId: number | null;
  Balance: number | null;
  LastLoginLocalDate: string | null;
  CreatedLocalDate: string | null;
  IsLocked: boolean | null;
  CurrencyId: string | null;
  Status?: number | null;
  ExternalId?: string | null;
  Language?: string | null;
  TimeZone?: string | null;
  RegistrationSource?: number | null;
  IsVerified?: boolean | null;
  IsTest?: boolean | null;
  DocNumber?: string | null;
  BTag?: string | null;
  RegistrationIp?: string | null;
  LastLoginIp?: string | null;
  FirstDepositDateLocal?: string | null;
  LastDepositDateLocal?: string | null;
  [key: string]: unknown;
}

export interface GetClientsResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data: {
    Count: number;
    Objects: ClientItem[];
  };
}

// Para çekme talepleri (GetClientWithdrawalRequestsWithTotals)
export interface WithdrawalRequestItem {
  Id: number | string;
  ClientId: number;
  ClientLogin: string;
  ClientName: string;
  ClientFirstName: string | null;
  ClientLastName: string | null;
  Amount: number;
  AmountEUR: number;
  CurrencyId: string;
  State: number | string;
  StateName: string;
  RequestTime: string | null;
  RequestTimeLocal: string | null;
  PaymentCreatedLocal: string | null;
  PaymentSystemName: string | null;
  Notes: string | null;
  Info: string | null;
  AllowUserName: string | null;
  RejectUserName: string | null;
  PaidUserName: string | null;
  RejectReason: string | null;
  [key: string]: unknown;
}

export interface WithdrawalRequestsResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data?: {
    ClientRequests: WithdrawalRequestItem[];
    TotalAmount: number;
    Count: number;
  };
}
// Para yatırmalar (GetDepositsWithdrawalsWithPaging)
export interface DepositItem {
  Id: number;
  PartnerId: number;
  TypeId: number;
  CurrencyId: string;
  Amount: number;
  ExchangedAmount: number;
  TransactionDate: string;
  CreatedLocal: string;
  ModifiedLocal: string;
  SessionId: number;
  Note: string | null;
  State: number;
  UpdateVersion: string;
  AmountExpression: string | null;
  ClientId: number;
  CashDeskId: number | null;
  PaidCashDeskId: number | null;
  GameId: number | null;
  ExternalId: string | null;
  PaymentSystemId: number;
  PaymentSystemName: string;
  ParentId: number | null;
  ClientName: string;
  ClientLogin: string;
  CashDeskName: string | null;
  TypeName: string;
  TypeCode: string | null;
  UserId: number;
  UserName: string;
  FromBuddyId: number | null;
  ToBuddyId: number | null;
  FromBuddyLogin: string | null;
  ToBuddyLogin: string | null;
  StateName: string | null;
}

export interface DepositsResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data: {
    Documents: {
      Count: number;
      Objects: DepositItem[];
    };
    TotalAmount: number;
  };
}

export interface ClientKpiData {
  Id: number;
  ClientId: number;
  Name: string | null;
  Login: string | null;
  TotalSportBets: number;
  TotalUnsettledBets: number;
  TotalSportStakes: number;
  TotalUnsettledStakes: number;
  TotalSportWinnings: number;
  TotalCasinoStakes: number;
  TotalCasinoWinnings: number;
  SportProfitness: number;
  CasinoProfitness: number;
  TotalDeposit: number;
  TotalWithdrawal: number;
  ProfitAndLose: number;
  GamingProfitAndLose: number;
  LastSportBetTime: string | null;
  LastCasinoBetTime: string | null;
  LastSportBetTimeLocal: string | null;
  LastCasinoBetTimeLocal: string | null;
  DepositAmount: number;
  DepositCount: number;
  FirstDepositTime: string | null;
  FirstDepositTimeLocal: string | null;
  LastDepositTime: string | null;
  LastDepositTimeLocal: string | null;
  WithdrawalCount: number;
  WithdrawalAmount: number;
  LastWithdrawalTime: string | null;
  LastWithdrawalTimeLocal: string | null;
  TotalSportBonusStakes: number;
  TotalSportBonusWinings: number;
  TotalCasinoBonusStakes: number;
  TotalCasinoBonusWinings: number;
  SportsbookProfileId: number | null;
  IsTest: boolean;
  IsVerified: boolean;
  CurrencyId: string | null;
  BTag: string | null;
  LastDepositAmount: number;
  LastWithdrawalAmount: number;
  Balance?: number;
  TotalBalance?: number;
  BonusBalance?: number;
  TotalBetAmount?: number;
  TotalWinAmount?: number;
  FreeSpinWin?: number;
  BonusPayout?: number;
  CashbackBonus?: number;
  LastLoginIp?: string | null;
  LastLoginDate?: string | null;
  RegistrationDate?: string | null;
}

export interface GetClientKpiResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: ClientKpiData;
}

export interface ClientNoteItem {
  Id: number;
  ClientId: number;
  Type: number;
  TypeName: string;
  Note: string;
  CreatedLocal: string;
  CreatedBy: string;
  ModifiedLocal: string | null;
  ModifiedBy: string | null;
}

export interface GetClientNotesResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: ClientNoteItem[];
}

/**
 * GetClientBonuses (profil bonuslar) API response item — API'deki tüm parametreler.
 * Id, AcceptanceType, AcceptanceDateLocal, ClientId, Count, PartnerBonusId, ResultType, ResultDateLocal,
 * Name, Description, ExpirationDateLocal, ExpirationDays, StartDateLocal, EndDateLocal, IsVisibleToAll,
 * Amount, AmountInRc, ClientBonusExpirationDateLocal, BonusType, ScheduleId, PartnerId, Source, ExternalId,
 * Note, CreatedByUserName, CreatedLocal, ModifiedByUserName, ModifiedLocal, CanAccept, IsNoBonus,
 * ClientBonusExternalId, RealAmount, RealAmountInRc, DepositAmount, DepositAmountInRc, WinAmount,
 * WageredAmount, ToWagerAmount, PaidAmount, PaidAmountInRc, UnfrozenAmount, UnfrozenAmountInRc,
 * TotalPaidAmount, TotalPaidAmountInRc, DocumentId, PaymentDocumentId, ClientName,
 * PaymentDocumentAmount, PaymentDocumentAmountInRc, PaymentDocumentCreatedLocal, ClientCurrency,
 * SportsbookProfileId, BTag, AffilateId, CancellationNote, CampainId, IsTest.
 */
export interface ClientBonusItem {
  Id: number;
  AcceptanceType?: number;
  AcceptanceDateLocal: string | null;
  ClientId: number;
  Count?: number;
  PartnerBonusId: number;
  ResultType: number;
  ResultDateLocal: string | null;
  Name: string;
  Description?: string | null;
  ExpirationDateLocal?: string | null;
  ExpirationDays?: number | null;
  StartDateLocal?: string | null;
  EndDateLocal?: string | null;
  IsVisibleToAll?: boolean;
  Amount: number;
  AmountInRc?: number;
  ClientBonusExpirationDateLocal?: string | null;
  BonusType?: number;
  ScheduleId?: number | null;
  PartnerId?: number;
  Source?: number;
  ExternalId?: number | null;
  Note?: string | null;
  CreatedByUserName?: string | null;
  CreatedLocal: string;
  ModifiedByUserName?: string | null;
  ModifiedLocal?: string | null;
  CanAccept?: boolean;
  IsNoBonus?: boolean;
  ClientBonusExternalId?: string | null;
  RealAmount?: number;
  RealAmountInRc?: number;
  DepositAmount?: number | null;
  DepositAmountInRc?: number | null;
  WinAmount?: number;
  WageredAmount?: number;
  ToWagerAmount?: number;
  PaidAmount?: number;
  PaidAmountInRc?: number;
  UnfrozenAmount?: number;
  UnfrozenAmountInRc?: number;
  TotalPaidAmount?: number;
  TotalPaidAmountInRc?: number;
  DocumentId?: number | null;
  PaymentDocumentId?: number | null;
  ClientName?: string | null;
  PaymentDocumentAmount?: number | null;
  PaymentDocumentAmountInRc?: number | null;
  PaymentDocumentCreatedLocal?: string | null;
  ClientCurrency?: string;
  SportsbookProfileId?: number | null;
  BTag?: string | null;
  AffilateId?: number | null;
  CancellationNote?: string | null;
  CampainId?: number | null;
  IsTest?: boolean;
  [key: string]: unknown;
}

export interface GetClientBonusesResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: ClientBonusItem[];
}

export interface ClientTransactionItem {
  Id: number;
  PartnerId: number;
  TypeId: number;
  CurrencyId: string;
  Amount: number;
  ExchangedAmount: number;
  TransactionDate: string;
  CreatedLocal: string;
  ModifiedLocal: string | null;
  SessionId: number;
  Note: string | null;
  State: number;
  UpdateVersion: string;
  AmountExpression: string | null;
  ClientId: number;
  CashDeskId: number | null;
  PaidCashDeskId: number | null;
  GameId: number | null;
  ExternalId: string | null;
  PaymentSystemId: number | null;
  PaymentSystemName: string | null;
  ParentId: number | null;
  ClientName: string;
  ClientLogin: string;
  CashDeskName: string | null;
  TypeName: string;
  TypeCode: string | null;
  UserId: number;
  UserName: string;
  FromBuddyId: number | null;
  ToBuddyId: number | null;
  FromBuddyLogin: string | null;
  ToBuddyLogin: string | null;
  StateName: string | null;
}

export interface GetClientTransactionsResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: {
    Count: number;
    Objects: ClientTransactionItem[];
    Provider?: 'lynon' | 'legacy';
    /** Lynon modunda sunucunun döndürdüğü kanonik tür listesi (tür filtresi için). */
    TransactionTypes?: Array<{ id: string; name: string }>;
  };
}
export interface ClientProfileTransactionItem {
  DocumentId: number | string;
  Amount: number;
  AccountId: string;
  CreatedLocal: string;
  DocumentTypeId: number;
  Operation: number;
  Created: string;
  DocumentTypeName: string;
  DocumentState: number | string;
  Note: string | null;
  Game: string | null;
  GameId: number | null;
  UserName: string;
  ClientId: number;
  FromBuddyId: number | null;
  FromBuddyLogin: string | null;
  ToBuddyId: number | null;
  ToBuddyLogin: string | null;
  Balance: number | null;
  PaymentSystemName: string | null;
  CashDeskId: number | null;
  CurrencyId: string;
  BetId: number | null;
  PaymentSystemId: number | null;
  BetStake: number | null;
  BetType: number | null;
  BetWinningAmount: number | null;
  IsManuallySettled: boolean | null;
}

export interface GetClientProfileTransactionsResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: {
    Provider?: 'lynon' | 'legacy';
    Count: number;
    Objects: ClientProfileTransactionItem[];
    /** Lynon modunda sunucunun döndürdüğü kanonik işlem türü listesi (tür filtresi için). */
    TransactionTypes?: Array<{ id: string; name: string }>;
  };
}
export interface DetailedReportItem {
  ClientId: number;
  ClientName: string;
  Login: string;
  CurrencyId: string;
  RegistrationDate: string;
  RegistrationDateLocal: string;
  SportsbookProfileId: number;
  CurrentBalance: number;
  BTag: string | null;
  AffilateId: number | null;
  AcceptanceDateLocal: string | null;
  ExpirationDateLocal: string | null;
  ResultDateLocal: string | null;
  SportBetAmount: number;
  SportBetCount: number;
  CasinoBetAmount: number;
  CasinoBetCount: number;
  SportBonusBetAmount: number;
  CasinoBonusBetAmount: number;
  SportBonusWinAmount: number;
  CasinoBonusWinAmount: number;
  SportBonusAmount: number;
  CasinoBonusAmount: number;
  ActiveBonusAmount: number;
  ActiveBonusType: number | null;
  PlayerType: number;
  SumBonusBalance: number;
  TotalBalance: number;
  SportNetProfit: number;
  CasinoNetProfit: number;
  SportNetProfitLessBonus: number;
  CasinoNetProfitLessBonus: number;
  SportTotalBetAmount: number;
  CasinoTotalBetAmount: number;
  SportRealMoneyWonAmount: number;
  CasinoRealMoneyWonAmount: number;
  NetProfit: number;
  NetProfitLessBonus: number;
  RealMoneyBetAmount: number;
  BonusBetAmount: number;
  TotalBetAmount: number;
  RealMoneyWonAmount: number;
  BonusWonAmount: number;
  ConvertedBonusAmount: number;
  DepositAmount: number;
  DepositCount: number;
  WithdrawalAmount: number;
  WithdrawalCount: number;
  IsVerified: boolean;
  PeriodStartBalance: number;
  PeriodEndBalance: number;
  CasinoPeriodStartBalance: number;
  CasinoPeriodEndBalance: number;
}

export interface GetDetailedReportResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: DetailedReportItem[];
}

// Bahis raporu (GetBetReport) – response Data.BetData.Objects öğeleri
export interface BetReportItem {
  Id: number;
  PartnerId: number;
  DocumentId: number | string;
  Type: number;
  TypeName: string;
  Amount: number;
  FreeBetAmount: number;
  BonusAmount: number;
  RealBetAmount: number;
  BonusBetAmount: number;
  WagerBonusWinAmount: number;
  WageringBonusId: number | null;
  WinningBonus: number;
  IsBonusMoney: boolean;
  Price: number;
  CurrencyId: string;
  State: number | string;
  StateName: string;
  Created: string;
  CreatedLocal: string;
  Number: number | null;
  ClientId: number;
  UpdateVersion: string;
  IsLive: boolean;
  IsTest: boolean;
  IsSuperBet: boolean;
  IsCounterOffer: boolean | null;
  AcceptTypeId: number;
  CheckDate: string | null;
  CheckDateLocal: string | null;
  CheckStatus: number;
  CalcDate: string | null;
  CalcDateLocal: string | null;
  ClientLogin: string;
  ClientLastName: string;
  ClientFirstName: string;
  ClientName: string;
  ClientCashDeskId: number | null;
  ClientCashDeskName: string | null;
  InputMethod: number;
  ExternalId: string | null;
  Details: string | null;
  WinningAmount: number;
  PossibleWin: number;
  CashDeskId: number | null;
  CashDeskName: string | null;
  InfoCashDeskId: number | null;
  InfoCashDeskName: string | null;
  BetshopId: number | null;
  BetShopName: string | null;
  InfoBetshopId: number | null;
  EquivalentWinning: number;
  EquivalentAmount: number;
  EquivalentPossibleWin: number;
  Source: number;
  SportsbookProfileId: number;
  ClientLoginIP: string;
  SystemMinCount: number | null;
  BTag: string | null;
  ClientBonusId: number | null;
  RecalculatedCount: number;
  SelectionCount: number;
  MannuallySettledUserId: number | null;
  ManuallySettledUserName: string | null;
  ParentBetId: number | null;
  EquivalentGGRAmount: number;
  PaidDate: string | null;
  TaxAmount: number;
  StakeTaxAmount: number | null;
  BetShopGroupId: number | null;
  ClientBetShopGroupId: number | null;
  PaidDateLocal: string | null;
  PaidCashDeskName: string | null;
  SourceName: string | null;
  RemainingAmount: number | null;
  EquivalentRemainingAmount: number | null;
  IsPartialCashout: boolean;
  IsAutoCashOut: boolean | null;
  IsCashOutDisabled: boolean | null;
  PartnerClientCategoryId: number | null;
  BonusType: number | null;
  BonusId: number | null;
  Barcode: string | null;
  BetSelections: unknown[];
  IsEachWay: boolean | null;
  [key: string]: unknown;
}

export interface GetBetReportResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data?: {
    BetReportSettings: unknown;
    BetData: {
      Count: number;
      Objects: BetReportItem[];
    };
  };
}

/** Bahis seçimleri: GetBetSelections */
export interface BetSelectionItem {
  BetId: number;
  SelectionId: number;
  Price: number;
  State: number | string;
  StateName: string;
  StartTime?: string;
  StartTimeLocal?: string;
  HomeTeamName?: string;
  AwayTeamName?: string;
  CompetitionId?: number;
  CompetitionName?: string;
  SelectionName?: string;
  MatchId?: number;
  MatchName?: string;
  MarketName?: string;
  Handicap?: number;
  SportId?: number;
  SportName?: string;
  RegionId?: number;
  RegionName?: string;
  IsLive?: boolean;
  MarketId?: number;
  DisplayMarketName?: string;
  DisplaySelectionName?: string;
  MatchInfo?: string | null;
  MatchResult?: string | null;
  VoidReason?: string | null;
  EndTimeLocal?: string | null;
  IsBanker?: boolean | null;
  [key: string]: unknown;
}

export interface GetBetSelectionsResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  ModelErrors?: unknown[];
  Data?: BetSelectionItem[];
}

export interface RegistrationStatsItem {
  DateLocal: string;
  RegisteredClientsCount: number;
  DepositedClientsCount: number;
  DepositsCount: number;
  DepositsAmount: number;
  ConvertionRate: number;
  AverageAmount: number;
}

export interface GetRegistrationStatsResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: RegistrationStatsItem[];
}

export interface RegistrationStatsDetailsItem {
  ClientId: number;
  PartnerId: number;
  Created: string;
  CreatedLocal: string;
  FirstDepositTime: string | null;
  FirstDepositTimeLocal: string | null;
  LastDepositTime: string | null;
  LastDepositTimeLocal: string | null;
  DepositCount: number;
  DepositAmount: number;
  DepositAmountInRC: number;
  DepositAverageAmount: number;
  DepositAverageAmountInRC: number;
  Login: string;
  Name: string;
  CurrencyId: string;
  BTag: string | null;
}

export interface GetRegistrationStatsDetailsResponse {
  HasError: boolean;
  AlertType: string;
  AlertMessage: string;
  ModelErrors: unknown[];
  Data: RegistrationStatsDetailsItem[];
}

export interface ProviderReportItem {
  PartnerId: number;
  CurrencyId: string;
  BetAmount: number;
  WinAmount: number;
  Profit: number;
  RakeWinAmount: number;
  RakeBetAmount: number;
  Rake: number;
  TicketAmount: number;
  ProviderPrefix: string;
  ProviderName: string;
  BetAmountByReportCurrency: number;
  WinAmountByReportCurrency: number;
  ProfitByReportCurrency: number;
  RakeWinAmountByReportCurrency: number;
  RakeBetAmountByReportCurrency: number;
  RakeByReportCurrency: number;
  TicketAmountByReportCurrency: number;
  Round: number;
}

export interface ProviderReportData {
  TotalCount: number;
  TotalWinCount: number | null;
  TotalRound: number;
  TotalBetAmountByReportCurrency: number;
  TotalWinAmountByReportCurrency: number;
  TotalProfitByReportCurrency: number;
  TotalRakeWinAmountByReportCurrency: number | null;
  TotalRakeBetAmountByReportCurrency: number | null;
  TotalRakeByReportCurrency: number | null;
  TotalBonusByReportCurrency: number;
  TotalTipByReportCurrency: number;
  TotalTaxByReportCurrency: number;
  TotalBankByReportCurrency: number;
  TotalFreeSpinWinAmountByReportCurrency: number;
  TotalJackpotWinAmountByReportCurrency: number;
  TotalTournamentWinAmountByReportCurrency: number;
  TotalCashbackBonusAmountByReportCurrency: number;
  ReportByTResultViewModel: ProviderReportItem[];
}

export interface GetProviderReportResponse {
  Result: ProviderReportData | null;
  HasError: boolean;
  ErrorId: number;
  ErrorDescription: string | null;
}

export interface TurnoverItem {
  ClientId: number;
  ClientName: string;
  CurrencyId: string;
  DepositAmount: number;
  WithdrawalAmount: number;
  ActualWithdrawalAmount: number;
  RejectedWithdrawalAmount: number;
  CasinoBetAmount: number;
  CasinoWinAmount: number;
  SportBetAmount: number;
  SportWinAmount: number;
  GGR: number;
  CurrentBalance: number;
  [key: string]: unknown;
}

export interface GetClientTurnoverPagingResponse {
  HasError: boolean;
  AlertType?: string;
  AlertMessage?: string | null;
  Data?: {
    TurnoverModel: TurnoverItem | null;
    TurnoverModelPaging: {
      Count: number;
      Objects: TurnoverItem[];
    };
  };
}
