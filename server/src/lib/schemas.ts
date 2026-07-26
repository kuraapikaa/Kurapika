/**
 * Input Validation Schemas (TypeBox)
 *
 * Fastify native JSON Schema validation için TypeBox şemaları.
 * Route'lara `{ schema: { body: LoginSchema } }` olarak eklenir.
 */
import { Type, type Static } from '@sinclair/typebox';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = Type.Object({
  username: Type.String({ minLength: 1, description: 'Kullanıcı adı veya email' }),
  password: Type.String({ minLength: 1, description: 'Şifre' }),
  provider: Type.Optional(Type.Union([Type.Literal('lynon'), Type.Literal('betconstruct')])),
});
export type LoginBody = Static<typeof LoginSchema>;

export const BonusPanelLoginSchema = Type.Object({
  username: Type.String({ minLength: 1, description: 'Oyuncu login adı' }),
});
export type BonusPanelLoginBody = Static<typeof BonusPanelLoginSchema>;

// ─── Token ───────────────────────────────────────────────────────────────────

export const UpdateTokenSchema = Type.Object({
  token: Type.String({ minLength: 10, description: 'BetConstruct authentication token' }),
});
export type UpdateTokenBody = Static<typeof UpdateTokenSchema>;

// ─── Bonus ───────────────────────────────────────────────────────────────────

export const ChargeBonusSchema = Type.Object({
  ClientId: Type.Number({ minimum: 1, description: 'Müşteri ID' }),
  BonusId: Type.Number({ minimum: 1, description: 'Bonus tanım ID' }),
  Amount: Type.Optional(Type.Number({ minimum: 0, description: 'Bonus miktarı' })),
});
export type ChargeBonusBody = Static<typeof ChargeBonusSchema>;

export const ManualAdjustmentSchema = Type.Object({
  ClientId: Type.Number({ minimum: 1, description: 'Müşteri ID' }),
  Amount: Type.Number({ description: 'Eklenecek/çıkarılacak miktar' }),
  Info: Type.Optional(Type.String({ description: 'İşlem açıklaması' })),
  DocTypeInt: Type.Optional(Type.Number({ description: 'Belge tipi (varsayılan: 3)' })),
});
export type ManualAdjustmentBody = Static<typeof ManualAdjustmentSchema>;

// ─── SMS ─────────────────────────────────────────────────────────────────────

export const SmsSendSchema = Type.Object({
  phones: Type.Array(Type.String({ minLength: 5 }), { minItems: 1, description: 'Telefon numaraları' }),
  text: Type.String({ minLength: 1, maxLength: 480, description: 'SMS metni' }),
});
export type SmsSendBody = Static<typeof SmsSendSchema>;

// ─── Genel API Filtreleri ────────────────────────────────────────────────────

export const DateRangeFilterSchema = Type.Object({
  FromDateLocal: Type.Optional(Type.String({ description: 'Başlangıç tarihi (DD-MM-YY veya ISO)' })),
  ToDateLocal: Type.Optional(Type.String({ description: 'Bitiş tarihi (DD-MM-YY veya ISO)' })),
  SkeepRows: Type.Optional(Type.Number({ minimum: 0, description: 'Atlanacak satır sayısı' })),
  MaxRows: Type.Optional(Type.Number({ minimum: 1, maximum: 5000, description: 'Maksimum satır sayısı' })),
});
export type DateRangeFilterBody = Static<typeof DateRangeFilterSchema>;

export const ClientIdQuerySchema = Type.Object({
  id: Type.String({ minLength: 1, description: 'Müşteri ID' }),
});
export type ClientIdQuery = Static<typeof ClientIdQuerySchema>;

// ─── Withdrawal Engine ──────────────────────────────────────────────────────

export const WithdrawalCheckSchema = Type.Object({
  clientId: Type.Number({ minimum: 1, description: 'Müşteri ID' }),
  promoIndex: Type.Optional(Type.Number({ minimum: 0, description: 'Promosyon index' })),
  promoId: Type.Optional(Type.String({ description: 'Promosyon ID' })),
  withdrawalDateLocal: Type.Optional(Type.String({ description: 'Çekim tarihi' })),
});
export type WithdrawalCheckBody = Static<typeof WithdrawalCheckSchema>;


