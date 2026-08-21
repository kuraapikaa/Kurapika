/**
 * Master panelinden gelen bağlantı alanlarının yorumlanması.
 *
 * Tek kural: BOŞ = "değiştirme", "sil" DEĞİL. Sır alanları panele
 * maskeli döndüğü için form her açıldığında boş gelir; boş değeri kayda
 * yazsaydık, operatörün parolaya hiç dokunmadan "kaydet"e basması
 * sitenin Lynon şifresini silerdi.
 *
 * Boolean alanlar ayrı bir dosyayı hak etti çünkü sessizce yanlıştı:
 * panel bu alanları <select> ile gönderiyor ve HTML select'in değeri her
 * zaman string'dir ("true" / "false"). Rota yalnızca
 * `typeof === 'boolean'` kabul ederken form değeri hiç yazılmıyordu --
 * panel "kaydedildi" diyor, kayıt değişmiyordu.
 */

export type BoolSonucu = { degisti: false } | { degisti: true; deger: boolean };

export function boolCozumle(deger: unknown): BoolSonucu {
  if (typeof deger === 'boolean') return { degisti: true, deger };
  if (typeof deger !== 'string') return { degisti: false };
  const kirpik = deger.trim().toLowerCase();
  if (kirpik === 'true') return { degisti: true, deger: true };
  if (kirpik === 'false') return { degisti: true, deger: false };
  return { degisti: false };
}
