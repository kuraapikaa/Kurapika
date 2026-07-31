import path from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { VARSAYILAN_KURALLAR } from './turnuvaSkoru.js';

/**
 * Turnuva ayarlari — tek okuyucu.
 *
 * Okuma mantigi dashboard.ts icinde gomuluydu; oyuncuya acik uc de ayni
 * ayarlara ihtiyac duyunca kopyalanmasi gerekecekti. Iki kopya, birinin
 * varsayilani degisince sessizce ayrisirdi.
 */

export type TurnuvaDonemi = 'gunluk' | 'haftalik' | 'aylik';
export const TURNUVA_DONEMLERI: TurnuvaDonemi[] = ['gunluk', 'haftalik', 'aylik'];

const VARSAYILAN = {
  gunluk: { prize: '50.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
  haftalik: { prize: '250.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
  aylik: { prize: '500.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
};

function ayarYolu(tenantKey: string): string {
  return path.resolve(process.cwd(), 'src', 'data', 'tournaments', `${safeTenantKey(tenantKey)}.json`);
}

const ESKI_YOL = path.resolve(process.cwd(), 'src', 'data', 'tournaments.json');

export async function readTournamentSettings(tenantKey = 'default'): Promise<Record<string, any>> {
  const anahtar = safeTenantKey(tenantKey);
  const kayitli = await readStoredDocument<Record<string, any>>({
    tenantKey: anahtar,
    namespace: 'tournaments',
    filePath: ayarYolu(anahtar),
    fallback: async () => {
      if (anahtar === 'default' && existsSync(ESKI_YOL)) {
        try {
          return JSON.parse(await readFile(ESKI_YOL, 'utf-8'));
        } catch {
          /* varsayilana dus */
        }
      }
      return { ...VARSAYILAN };
    },
  });

  // Donem bazinda varsayilanla birlestir: kayitli belge eski surumden
  // geliyorsa (yalnizca prize iceriyorsa) eksik alanlar yine dolu gelsin.
  const sonuc: Record<string, any> = {};
  for (const donem of TURNUVA_DONEMLERI) {
    sonuc[donem] = {
      ...VARSAYILAN[donem],
      ...(kayitli?.[donem] ?? {}),
      kurallar: { ...VARSAYILAN_KURALLAR, ...(kayitli?.[donem]?.kurallar ?? {}) },
    };
  }
  return sonuc;
}

export async function writeTournamentSettings(tenantKey: string, data: unknown): Promise<void> {
  const anahtar = safeTenantKey(tenantKey);
  await writeStoredDocument({ tenantKey: anahtar, namespace: 'tournaments', filePath: ayarYolu(anahtar) }, data);
}
