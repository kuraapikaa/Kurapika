import { describe, expect, it } from 'vitest';
import { istekKimligi, loginEsit, oyuncuVerisineErisebilir } from './istekKimligi.js';

/**
 * GUVENLIK REGRESYON TESTI.
 *
 * /admin/bonus/check-player hem panel operatoru hem oyuncu tarafindan
 * cagrilabiliyor. `login` istek govdesinden okundugu icin bir oyuncu
 * oturumu BASKA bir oyuncunun tam hesap goruntusunu (bakiye, yatirim
 * gecmisi, dogrulama durumu, son giris IP'si, operator notlari, risk
 * analizi) okuyabiliyordu.
 */

const panelOturumu = (username = 'operator1', role = 'operator') =>
  ({ session: { user: { username, role } } });
const oyuncuOturumu = (login = 'ayse') => ({ session: { bonusPanelUser: { login } } });

describe('kimlik çözümleme', () => {
  it('panel oturumu tanınır', () => {
    expect(istekKimligi(panelOturumu('admin', 'admin'))).toEqual({
      tur: 'panel', kimlik: 'admin', rol: 'admin',
    });
  });

  it('oyuncu oturumu tanınır ve kimliği ön ekli', () => {
    expect(istekKimligi(oyuncuOturumu('ayse'))).toEqual({
      tur: 'oyuncu', kimlik: 'oyuncu:ayse', login: 'ayse',
    });
  });

  it('panel oturumu ÖNCELİKLİ — operatör aynı tarayıcıda oyuncu girişi de yapmış olabilir', () => {
    const ikisiDe = { session: { user: { username: 'op', role: 'admin' }, bonusPanelUser: { login: 'ayse' } } };
    expect(istekKimligi(ikisiDe)).toMatchObject({ tur: 'panel', kimlik: 'op' });
  });

  it('oturum yoksa null', () => {
    expect(istekKimligi({})).toBeNull();
    expect(istekKimligi({ session: {} })).toBeNull();
    expect(istekKimligi(null)).toBeNull();
    expect(istekKimligi(undefined)).toBeNull();
  });

  it('oyuncu kimliği "oyuncu:" ön ekiyle ayrılır — aynı adlı operatörle karışmaz', () => {
    const p = istekKimligi(panelOturumu('ayse'))!;
    const o = istekKimligi(oyuncuOturumu('ayse'))!;
    expect(p.kimlik).not.toBe(o.kimlik);
  });
});

describe('oyuncu verisine erişim', () => {
  it('operatör her oyuncuyu görebilir', () => {
    const op = istekKimligi(panelOturumu());
    expect(oyuncuVerisineErisebilir(op, 'ayse')).toBe(true);
    expect(oyuncuVerisineErisebilir(op, 'mehmet')).toBe(true);
  });

  it('oyuncu kendi kaydını görebilir', () => {
    expect(oyuncuVerisineErisebilir(istekKimligi(oyuncuOturumu('ayse')), 'ayse')).toBe(true);
  });

  it('oyuncu BAŞKASININ kaydını göremez — bildirilen açık', () => {
    expect(oyuncuVerisineErisebilir(istekKimligi(oyuncuOturumu('ayse')), 'mehmet')).toBe(false);
  });

  it('büyük/küçük harf ve boşluk farkı erişimi engellemez', () => {
    const o = istekKimligi(oyuncuOturumu('Ayse'));
    expect(oyuncuVerisineErisebilir(o, '  ayse ')).toBe(true);
    expect(oyuncuVerisineErisebilir(o, 'AYSE')).toBe(true);
  });

  it('oturumsuz istek reddedilir', () => {
    expect(oyuncuVerisineErisebilir(null, 'ayse')).toBe(false);
  });

  it('boş hedef login reddedilir — boş string eşleşme sayılmaz', () => {
    expect(oyuncuVerisineErisebilir(istekKimligi(oyuncuOturumu('ayse')), '')).toBe(false);
    expect(oyuncuVerisineErisebilir(istekKimligi(oyuncuOturumu('ayse')), null)).toBe(false);
    expect(oyuncuVerisineErisebilir(istekKimligi(oyuncuOturumu('ayse')), undefined)).toBe(false);
  });
});

describe('login karşılaştırma', () => {
  it('boş değerler asla eşleşmez', () => {
    expect(loginEsit('', '')).toBe(false);
    expect(loginEsit(null, null)).toBe(false);
    expect(loginEsit('  ', '')).toBe(false);
  });

  it('Türkçe harflerde tutarlı', () => {
    expect(loginEsit('İsmail', 'i̇smail')).toBe(true);
    expect(loginEsit('AYŞE', 'ayşe')).toBe(true);
  });
});
