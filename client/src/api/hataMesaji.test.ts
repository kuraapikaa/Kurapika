import { describe, expect, it } from 'vitest';
import { ApiError } from './client';

/**
 * Oyun uçları hatayı `{ ok:false, message:"..." }` biçiminde döner. `message`
 * okunmadığı için "Günlük çark hakkınızı kullandınız" gibi açıklamalar düşüyor,
 * yerine ham statusText geçiyor ve arayüz her şeyi oturum hatası sanıyordu.
 *
 * hataMesaji dışa açık olmadığından aynı öncelik sırası burada sınanır.
 */
function hataMesaji(json: Record<string, unknown>, res: { statusText: string }): string {
  return (
    (json.ErrorDescription as string) ||
    (json.AlertMessage as string) ||
    (json.message as string) ||
    res.statusText
  );
}

const res = { statusText: 'Too Many Requests' };

describe('API hata mesajı seçimi', () => {
  it('oyun uçlarının message alanını okur', () => {
    expect(hataMesaji({ ok: false, message: 'Günlük çark hakkınızı kullandınız. Limit: 1' }, res))
      .toBe('Günlük çark hakkınızı kullandınız. Limit: 1');
  });

  it('BetConstruct AlertMessage önceliğini korur', () => {
    expect(hataMesaji({ AlertMessage: 'Oturum süreniz dolmuş.', message: 'baska' }, res))
      .toBe('Oturum süreniz dolmuş.');
  });

  it('ErrorDescription her şeyin önünde gelir', () => {
    expect(hataMesaji({ ErrorDescription: 'ilk', AlertMessage: 'ikinci', message: 'ucuncu' }, res))
      .toBe('ilk');
  });

  it('hiçbiri yoksa statusText\'e düşer', () => {
    expect(hataMesaji({}, res)).toBe('Too Many Requests');
  });

  it('boş message statusText\'i gölgelemez', () => {
    expect(hataMesaji({ message: '' }, res)).toBe('Too Many Requests');
  });
});

describe('ApiError', () => {
  it('401 yetkisiz olarak işaretlenir', () => {
    expect(new ApiError('x', 401).isUnauthorized).toBe(true);
  });

  it('429 yetkisiz değildir — oturum hatası sanılmamalı', () => {
    expect(new ApiError('Günlük hakkınız doldu', 429).isUnauthorized).toBe(false);
  });
});
