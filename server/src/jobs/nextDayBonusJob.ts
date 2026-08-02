import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { evaluateForAccount } from '../services/promoEvaluator.js';
import { assignmentValuesForPromoSpec, getRules, type PromoSpec, type RulesConfig } from '../services/rulesService.js';
import { atamaNotu } from '../services/bonusAtamaNotu.js';
import {
  isLynonConfigured,
  istanbulDateKey,
  istanbulDayBoundsUtc,
  lynonAdjustPlayerMainAccount,
  lynonAssignCampaignToPlayer,
  lynonBonusDefinitions,
  lynonBuildBonusEligibilitySnapshot,
  lynonCorrectionHistory,
  lynonPaymentTransactions,
  previousIstanbulDateKey,
} from '../services/lynonBackofficeService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', 'data', 'next-day-bonus-runs', 'default.json');
const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const BETWEEN_PLAYERS_MS = 350;

type RunRecord = {
  status: 'granted' | 'ineligible' | 'already-granted' | 'error';
  at: string;
  message?: string;
};

type RunState = {
  version: 1;
  completedDates: string[];
  records: Record<string, RunRecord>;
};

type AutoRule = {
  key: string;
  group: 'id' | 'title';
  spec: PromoSpec;
};

const emptyState = (): RunState => ({ version: 1, completedDates: [], records: {} });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadState(): Promise<RunState> {
  const parsed = await readStoredDocument<Partial<RunState>>({
    tenantKey: 'default',
    namespace: 'next-day-bonus-runs',
    filePath: STATE_PATH,
    fallback: emptyState(),
  });
  return {
    version: 1,
    completedDates: Array.isArray(parsed.completedDates) ? parsed.completedDates.map(String) : [],
    records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
  };
}

async function saveState(state: RunState): Promise<void> {
  await writeStoredDocument(
    { tenantKey: 'default', namespace: 'next-day-bonus-runs', filePath: STATE_PATH },
    state,
  );
}

function istanbulHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? -1),
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? -1),
  };
}

function automaticRules(rules: RulesConfig): AutoRule[] {
  const rows: AutoRule[] = [
    ...Object.entries(rules.PROMO_SPECS).map(([key, spec]) => ({ key, group: 'id' as const, spec })),
    ...Object.entries(rules.PROMO_TITLE_SPECS).map(([key, spec]) => ({ key, group: 'title' as const, spec })),
  ];
  const unique = new Map<string, AutoRule>();
  for (const row of rows) {
    if (row.spec.enabled === false || row.spec.isNextDayBonus !== true || row.spec.autoGrantNextDayAt0015 !== true) continue;
    const identity = `${String(row.spec.type ?? 'partner')}:${row.spec.partnerBonusId ?? row.group}:${row.key}`;
    if (!unique.has(identity)) unique.set(identity, row);
  }
  return [...unique.values()];
}

async function previousDayDepositorIds(previousDateKey: string): Promise<Array<number | string>> {
  const bounds = istanbulDayBoundsUtc(previousDateKey);
  const rows: Record<string, any>[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageRows = await lynonPaymentTransactions({
      FromCreatedDateLocal: bounds.from,
      ToCreatedDateLocal: bounds.to,
      MaxRows: PAGE_SIZE,
      SkeepRows: page * PAGE_SIZE,
    }, { transactionTypes: 'deposit', status: ['success'] });
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return [...new Set(rows.map((row) => row.userId).filter((id) => id !== null && id !== undefined && String(id).trim() !== ''))];
}

function stateKey(dateKey: string, rule: AutoRule, playerId: number | string): string {
  return `${dateKey}:${rule.group}:${rule.key}:${playerId}`;
}

function cashNote(dateKey: string, rule: AutoRule): string {
  return `NB ertesi gun ${dateKey} ${rule.key}`.slice(0, 50);
}

async function cashAlreadyCredited(playerId: number | string, dateKey: string, note: string): Promise<boolean> {
  const bounds = istanbulDayBoundsUtc(dateKey);
  const response = await lynonCorrectionHistory({
    ClientId: playerId,
    FromCreatedDateLocal: bounds.from,
    ToCreatedDateLocal: bounds.to,
    MaxRows: 500,
    SkeepRows: 0,
  });
  const rows = Array.isArray(response?.Data?.Objects) ? response.Data.Objects : [];
  return rows.some((row: any) => String(row.note ?? '').trim() === note);
}

export type KuruKapi = { ad: string; gecti: boolean; aciklama: string };

export type KuruSonuc = {
  playerId: string;
  dateKey: string;
  kapilar: KuruKapi[];
  /** Tum kapilar gecerse bonus verilirdi. */
  verilirdi: boolean;
  /** Verilecek tutar (hesaplanabildiyse). */
  tutar: number | null;
};

/**
 * Ertesi gun bonusunu KURU calistirir: hicbir sey yazmaz, atama yapmaz.
 *
 * Is yalnizca Turkiye saatiyle 00:15-00:19 arasinda calisiyor. Bu 5 dakikalik
 * pencere disinda "neden eklenmedi" sorusunu cevaplamanin hicbir yolu yoktu;
 * kural degistirip ertesi geceye kadar beklemek gerekiyordu.
 *
 * Bu fonksiyon isin kapilarindan AYNI sirayla gecer ve her birinin sonucunu
 * doner. Zaman penceresi ve idempotency kayitlari KASITLI olarak atlanir —
 * amac "su anda calissaydi ne olurdu" sorusunu cevaplamak.
 */
export async function nextDayBonusKuruCalistir(
  playerId: string | number,
  now = new Date(),
): Promise<KuruSonuc> {
  const dateKey = istanbulDateKey(now);
  const kapilar: KuruKapi[] = [];
  const ekle = (ad: string, gecti: boolean, aciklama: string) => {
    kapilar.push({ ad, gecti, aciklama });
    return gecti;
  };

  if (!ekle('Lynon baglantisi', isLynonConfigured(), isLynonConfigured() ? 'Yapilandirilmis' : 'Lynon yapilandirilmamis')) {
    return { playerId: String(playerId), dateKey, kapilar, verilirdi: false, tutar: null };
  }

  const rules = await getRules('default');
  const activeRules = automaticRules(rules);
  if (!ekle(
    'Otomatik kural',
    activeRules.length > 0,
    activeRules.length > 0
      ? `${activeRules.length} kural aktif: ${activeRules.map((r) => r.key).join(', ')}`
      : 'Hicbir kuralda isNextDayBonus + autoGrantNextDayAt0015 birlikte acik degil',
  )) {
    return { playerId: String(playerId), dateKey, kapilar, verilirdi: false, tutar: null };
  }

  const previousDateKey = previousIstanbulDateKey(now);
  const oncekiGunOyuncular = await previousDayDepositorIds(previousDateKey);
  const listede = oncekiGunOyuncular.some((id: unknown) => String(id) === String(playerId));
  ekle(
    'Onceki gun yatirimi',
    listede,
    listede
      ? `${previousDateKey} tarihinde yatirimi var`
      : `${previousDateKey} tarihinde basarili yatirimi YOK (o gun ${oncekiGunOyuncular.length} oyuncu yatirim yapmis)`,
  );

  const catalog = await lynonBonusDefinitions();
  const catalogRows = Array.isArray(catalog.Result) ? catalog.Result : [];
  const campaignById = new Map<number, any>(
    catalogRows
      .filter((row: any) => Number.isInteger(Number(row.PartnerBonusId)) && Number(row.PartnerBonusId) > 0 && row.IsDeleted !== true && row.IsDisabled !== true)
      .map((row: any) => [Number(row.PartnerBonusId), row] as const)
  );

  let verilirdi = false;
  let tutar: number | null = null;

  for (const rule of activeRules) {
    const configuredType = String(rule.spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
    const isCash = configuredType === 'cash' || configuredType === 'nakit';
    const campaignId = Number(rule.spec.partnerBonusId);
    const campaign = isCash ? null : campaignById.get(campaignId);

    if (!ekle(
      `[${rule.key}] Lynon kampanyasi`,
      isCash || Boolean(campaign),
      isCash
        ? 'Nakit bonus; kampanya gerekmiyor'
        : campaign
          ? `Aktif: ${campaign.Name ?? campaignId}`
          : `PartnerBonusId ${rule.spec.partnerBonusId ?? 'eksik'} icin aktif kampanya YOK (silinmis/pasif olabilir)`,
    )) continue;

    const account = await lynonBuildBonusEligibilitySnapshot({ playerId });
    const promoId = rule.group === 'id' && Number.isFinite(Number(rule.key)) ? Number(rule.key) : campaignId;
    const promoTitle = rule.group === 'title' ? rule.key : String(campaign?.Name ?? rule.key);
    const check = await evaluateForAccount(account as any, { id: promoId, title: promoTitle, kuralAnahtari: rule.key, ...rule.spec } as any, rules, 'default', 'bonus');

    const dusenler = check.items.filter((item) => !item.ok);
    ekle(
      `[${rule.key}] Uygunluk kurallari`,
      check.overallOk,
      check.overallOk ? 'Tum maddeler gecti' : dusenler.map((i) => i.reason || i.label).join(' | ').slice(0, 500),
    );

    const hesaplanan = Number(check.calculatedAmount ?? rule.spec.fixedAmount ?? 0);
    ekle(
      `[${rule.key}] Tutar`,
      Number.isFinite(hesaplanan) && hesaplanan > 0,
      Number.isFinite(hesaplanan) && hesaplanan > 0
        ? `${hesaplanan} TRY`
        : 'Hesaplanan tutar 0 — barem/yuzde tanimi eksik olabilir',
    );

    if (check.overallOk && hesaplanan > 0 && listede) {
      verilirdi = true;
      tutar = hesaplanan;
    }
  }

  return { playerId: String(playerId), dateKey, kapilar, verilirdi, tutar };
}

export async function runNextDayBonusJob(now = new Date()): Promise<{
  skipped: boolean;
  dateKey: string;
  rules: number;
  players: number;
  granted: number;
  errors: number;
}> {
  const dateKey = istanbulDateKey(now);
  const baseResult = { skipped: true, dateKey, rules: 0, players: 0, granted: 0, errors: 0 };
  if (!isLynonConfigured()) return baseResult;

  const { hour, minute } = istanbulHourMinute(now);
  // 00:15'te başlar; geçici API hataları için 00:19'a kadar güvenli/idempotent yeniden deneme penceresi vardır.
  if (hour !== 0 || minute < 15 || minute > 19) return baseResult;

  const rules = await getRules('default');
  const activeRules = automaticRules(rules);
  if (!activeRules.length) return { ...baseResult, rules: 0 };

  const state = await loadState();
  if (state.completedDates.includes(dateKey)) return { ...baseResult, rules: activeRules.length };

  const previousDateKey = previousIstanbulDateKey(now);
  const playerIds = await previousDayDepositorIds(previousDateKey);
  const catalogResponse = await lynonBonusDefinitions();
  const catalogRows = Array.isArray(catalogResponse.Result) ? catalogResponse.Result : [];
  const campaignById = new Map(
    catalogRows
      .filter((row: any) => Number.isInteger(Number(row.PartnerBonusId)) && Number(row.PartnerBonusId) > 0 && row.IsDeleted !== true && row.IsDisabled !== true)
      .map((row: any) => [Number(row.PartnerBonusId), row] as const)
  );

  let granted = 0;
  let errors = 0;
  let hasRetryableError = false;

  for (const playerId of playerIds) {
    for (const rule of activeRules) {
      const key = stateKey(dateKey, rule, playerId);
      const existing = state.records[key];
      if (existing && existing.status !== 'error') continue;

      try {
        const account = await lynonBuildBonusEligibilitySnapshot({ playerId });
        const configuredType = String(rule.spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
        const isCash = configuredType === 'cash' || configuredType === 'nakit';
        const campaignId = Number(rule.spec.partnerBonusId);
        const campaign = isCash ? null : campaignById.get(campaignId);
        if (!isCash && !campaign) throw new Error(`Aktif Lynon kampanyası bulunamadı: ${rule.spec.partnerBonusId ?? 'eksik'}`);

        const promoId = rule.group === 'id' && Number.isFinite(Number(rule.key)) ? Number(rule.key) : campaignId;
        const promoTitle = rule.group === 'title' ? rule.key : String(campaign?.Name ?? rule.key);
        const check = await evaluateForAccount(account as any, { id: promoId, title: promoTitle, kuralAnahtari: rule.key, ...rule.spec } as any, rules, 'default', 'bonus');
        if (!check.overallOk) {
          state.records[key] = {
            status: 'ineligible',
            at: new Date().toISOString(),
            message: check.items.filter((item) => !item.ok).map((item) => item.reason || item.label).join(' | ').slice(0, 500),
          };
          await saveState(state);
          continue;
        }

        if (!isCash) {
          const alreadyAssigned = Array.isArray((account as any).bonuses) && (account as any).bonuses.some((bonus: any) =>
            Number(bonus.Id) === campaignId && istanbulDateKey(String(bonus.CreatedLocal ?? '')) === dateKey
          );
          if (alreadyAssigned) {
            state.records[key] = { status: 'already-granted', at: new Date().toISOString(), message: 'Lynon kampanyası bugün zaten atanmış.' };
            await saveState(state);
            continue;
          }

          const calculatedAmount = Number(check.calculatedAmount ?? 0);
          const configuredAssignmentValues = assignmentValuesForPromoSpec(rule.spec);
          const assignmentValues = {
            ...configuredAssignmentValues,
            ...(calculatedAmount > 0 && configuredAssignmentValues.BonusMoneyAmount == null ? { BonusMoneyAmount: calculatedAmount } : {}),
          };
          await lynonAssignCampaignToPlayer({
            campaignId,
            playerId,
            assignmentReason: atamaNotu({
              onek: `Ertesi gün otomasyonu ${previousDateKey}`,
              kaynak: 'otomasyon',
              kuralAnahtari: rule.key,
              baslik: rule.spec?.title,
              tutar: calculatedAmount,
            }),
            assignmentValues,
          });
        } else {
          const amount = Number(check.calculatedAmount ?? rule.spec.fixedAmount ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('Otomatik nakit bonus tutarı pozitif değil.');
          const note = cashNote(dateKey, rule);
          if (await cashAlreadyCredited(playerId, dateKey, note)) {
            state.records[key] = { status: 'already-granted', at: new Date().toISOString(), message: 'Crediting düzeltmesi bugün zaten işlendi.' };
            await saveState(state);
            continue;
          }
          await lynonAdjustPlayerMainAccount({ playerId, amount, correctionType: 'crediting', note });
        }

        granted += 1;
        state.records[key] = { status: 'granted', at: new Date().toISOString() };
        await saveState(state);
      } catch (error) {
        errors += 1;
        hasRetryableError = true;
        state.records[key] = { status: 'error', at: new Date().toISOString(), message: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
        await saveState(state);
      }
      await sleep(BETWEEN_PLAYERS_MS);
    }
  }

  if (!hasRetryableError) {
    state.completedDates = [...new Set([...state.completedDates, dateKey])].slice(-45);
    await saveState(state);
  }

  return { skipped: false, dateKey, rules: activeRules.length, players: playerIds.length, granted, errors };
}