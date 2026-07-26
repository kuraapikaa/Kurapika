/**
 * BetConstruct API yanıtları için tip tanımları.
 * `any` kullanımını azaltmak için merkezi tip havuzu.
 */

// ─── Genel API Yanıtı ──────────────────────────────────────────────────────
export interface BCApiResponse<T = unknown> {
  HasError?: boolean;
  AlertMessage?: string;
  ErrorDescription?: string;
  Data?: T;
}

export interface BCPaginatedData<T> {
  Count?: number;
  Objects?: T[];
}

// ─── Client / Oyuncu ────────────────────────────────────────────────────────
export interface BCClient {
  Id: number;
  Login?: string;
  FirstName?: string;
  LastName?: string;
  Balance?: number;
  IsTest?: boolean;
  CreatedLocalDate?: string;
  BTag?: string;
  [key: string]: unknown;
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
export interface BCClientKpi {
  Login?: string;
  Name?: string;
  TotalDeposit?: number;
  FirstDepositTimeLocal?: string;
  LastSportBetTimeLocal?: string;
  LastCasinoBetTimeLocal?: string;
  IsTest?: boolean;
  BTag?: string;
  [key: string]: unknown;
}

// ─── Bonus ───────────────────────────────────────────────────────────────────
export interface BCBonus {
  Id: number;
  Name: string;
  Amount: number;
  WageredAmount: number;
  ToWagerAmount: number;
  RealAmount: number;
  WinAmount: number;
  PaidAmount: number;
  BonusType?: number;
  ResultType?: number;
  CreatedLocal?: string;
  AcceptanceDateLocal?: string;
  ClientBonusExpirationDateLocal?: string;
  [key: string]: unknown;
}

// ─── Profil İşlemi (Transaction) ─────────────────────────────────────────────
export interface BCProfileTransaction {
  DocumentId: number;
  DocumentTypeId: number;
  DocumentTypeName: string;
  DocumentState?: number;
  Amount: number;
  Operation?: number;
  CreatedLocal?: string;
  Game?: string;
  Note?: string;
  [key: string]: unknown;
}

// ─── Not ──────────────────────────────────────────────────────────────────────
export interface BCNote {
  Id: number;
  Note: string;
  CreatedLocal?: string;
  [key: string]: unknown;
}

// ─── Çekim Talebi (Withdrawal Request) ───────────────────────────────────────
export interface BCWithdrawalRequest {
  Id: number;
  ClientId: number;
  Amount?: number;
  Status?: number;
  RequestTime?: string;
  RequestTimeLocal?: string;
  PaymentSystemId?: number;
  [key: string]: unknown;
}

// ─── İşlem Tür Özeti ─────────────────────────────────────────────────────────
export interface TransactionTypeSummary {
  count: number;
  totalAmount: number;
}

// ─── Tenant ──────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  siteName: string;
  domain?: string;
  adminEmail: string;
  /** Hashlenmiş şifre (bcrypt). */
  adminPasswordHash: string;
  /** @deprecated Düz metin şifre — geçiş süreci için. */
  adminPassword?: string;
  partnerId?: string;
  isActive: boolean;
  expireDate?: string;
  createdAt?: string;
  themeColor?: string;
  logoUrl?: string;
  adminTitle?: string;
  staffUsers?: StaffUser[];
}

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  passwordHash?: string;
  password?: string;
  role: 'manager' | 'operator' | 'viewer' | 'finance' | 'support';
  permissions: string[];
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────
export interface SessionUser {
  username: string;
  role: 'admin' | 'operator';
  tenantId?: string;
  siteName?: string;
  staffId?: string;
  displayName?: string;
  permissions?: string[];
  dataProvider?: 'lynon' | 'betconstruct';
}

export interface BonusPanelUser {
  login: string;
}


