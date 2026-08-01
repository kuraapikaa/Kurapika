import { describe, expect, it } from 'vitest';
import { kilitle } from '../lib/odulKilidi.js';

/**
 * ODUL TALEBI YARIS KOSULU.
 *
 * Bildirilen vaka: oyuncu 2490282 hesabinda cok sayida KAMPANYA bonusu.
 *
 * /games/daily-tasks/claim ve /games/battle-pass/claim soyle isliyordu:
 *
 *   1. alreadyClaimed kontrolu
 *   2. grantReward(...)            <- odul VERILIYOR
 *   3. claims.push + write         <- kayit SONRA yaziliyor
 *
 * 2 ile 3 arasinda kayit yok. Ikinci bir istek (cift tiklama, istemci
 * yeniden denemesi, iki sekme) 1'den de geciyor ve ayni gorev icin
 * IKINCI bir bonus daha taniml aniyor.
 *
 * Cark bu deseni zaten dogru uyguluyordu: pending yaz -> odulu ver ->
 * kaydi tamamla.
 */

type Kayit = { id: string; username: string; taskId: string; dateKey: string; status?: string };

/** Depo yazma/okuma gecikmesini taklit eden basit ortam. */
function ortam() {
  let depo: Kayit[] = [];
  return {
    oku: async () => {
      await new Promise((r) => setTimeout(r, 1));
      return [...depo];
    },
    yaz: async (yeni: Kayit[]) => {
      await new Promise((r) => setTimeout(r, 1));
      depo = [...yeni];
    },
    hepsi: () => depo,
  };
}

/** ESKI akis: ver, sonra yaz. */
async function eskiAkis(o: ReturnType<typeof ortam>, verilenler: string[]) {
  const claims = await o.oku();
  if (claims.some((c) => c.username === 'ayse' && c.taskId === 't1' && c.dateKey === 'g1')) return 'zaten';
  verilenler.push('odul');                                   // grantReward
  const guncel = await o.oku();
  guncel.push({ id: String(Math.random()), username: 'ayse', taskId: 't1', dateKey: 'g1' });
  await o.yaz(guncel);
  return 'verildi';
}

/** YENI akis: once rezerve et, sonra ver. */
async function yeniAkis(o: ReturnType<typeof ortam>, verilenler: string[]) {
  const claims = await o.oku();
  if (claims.some((c) => c.username === 'ayse' && c.taskId === 't1' && c.dateKey === 'g1')) return 'zaten';
  const id = String(Math.random());
  claims.push({ id, username: 'ayse', taskId: 't1', dateKey: 'g1', status: 'pending' });
  await o.yaz(claims);                                       // REZERVE
  verilenler.push('odul');                                   // grantReward
  const guncel = await o.oku();
  const kayit = guncel.find((c) => c.id === id);
  if (kayit) kayit.status = 'granted';
  await o.yaz(guncel);
  return 'verildi';
}

/** Rezerve-once + KILIT: uretimde kullanilan hali. */
async function kilitliAkis(o: ReturnType<typeof ortam>, verilenler: string[]) {
  return kilitle('odul:ayse:gorev:t1:g1', () => yeniAkis(o, verilenler));
}

describe('eş zamanlı ödül talebi', () => {
  it('ESKİ akış: iki eş zamanlı istek İKİ ödül veriyor — bildirilen hata', async () => {
    const o = ortam();
    const verilenler: string[] = [];
    await Promise.all([eskiAkis(o, verilenler), eskiAkis(o, verilenler)]);
    expect(verilenler).toHaveLength(2);
  });

  it('REZERVE-ÖNCE tek başına YETMİYOR — pencere daralır, kapanmaz', async () => {
    // Bu olcum kilit eklemenin gerekcesi. Kayit sirasini duzeltmek
    // read-modify-write'i atomik yapmiyor; iki istek okuma asamasini
    // birlikte geciyor.
    const o = ortam();
    const verilenler: string[] = [];
    await Promise.all([yeniAkis(o, verilenler), yeniAkis(o, verilenler)]);
    expect(verilenler.length).toBeGreaterThan(1);
  });

  it('KİLİTLİ akış: iki eş zamanlı istekte tek ödül', async () => {
    const o = ortam();
    const verilenler: string[] = [];
    const sonuclar = await Promise.all([kilitliAkis(o, verilenler), kilitliAkis(o, verilenler)]);
    expect(verilenler).toHaveLength(1);
    expect(sonuclar.filter((s) => s === 'verildi')).toHaveLength(1);
    expect(sonuclar.filter((s) => s === 'zaten')).toHaveLength(1);
  });

  it('KİLİTLİ akış: üç eş zamanlı istekte de tek ödül', async () => {
    const o = ortam();
    const verilenler: string[] = [];
    await Promise.all([kilitliAkis(o, verilenler), kilitliAkis(o, verilenler), kilitliAkis(o, verilenler)]);
    expect(verilenler).toHaveLength(1);
  });

  it('sıralı ikinci istek de engellenir', async () => {
    const o = ortam();
    const verilenler: string[] = [];
    await kilitliAkis(o, verilenler);
    expect(await kilitliAkis(o, verilenler)).toBe('zaten');
    expect(verilenler).toHaveLength(1);
  });

  it('rezervasyon kaydı depoda kalır ve granted olur', async () => {
    const o = ortam();
    await kilitliAkis(o, []);
    expect(o.hepsi()).toHaveLength(1);
    expect(o.hepsi()[0].status).toBe('granted');
  });
});
