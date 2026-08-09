import { AllCommunityModule, ModuleRegistry, colorSchemeDark, themeQuartz } from 'ag-grid-community';

/**
 * AG GRID KURULUMU.
 *
 * v33+ "Theming API" modulerlestirildi: kullanilan ozellikler acikca
 * kaydedilmeli, aksi halde tablo bos/hatali kaliyor. Bu modul tek
 * import noktasi -- kayit BIR KERE burada yapiliyor, her sayfa
 * tekrar etmiyor.
 *
 * Renk: temalar `.aqua` kapsamindaki sabit mavi vurguyu (`#0071e3` /
 * `#0a84ff`) birebir kopyaliyor, CSS degiskeni OKUMUYOR -- AG Grid'in
 * tema nesnesi olusturma anindaki duz degerlerle calisiyor, `var()`
 * cozemiyor. Iki ayri nesne (acik/koyu), sayfa `useTema()`'nin verdigi
 * `koyu` boole'una gore hangisini kullanacagina karar veriyor.
 */
ModuleRegistry.registerModules([AllCommunityModule]);

const ORTAK_PARAMS = {
  borderRadius: 8,
  wrapperBorderRadius: 10,
  fontSize: 13,
  headerFontWeight: 600,
  spacing: 8,
};

export const agTemaAcik = themeQuartz.withParams({
  ...ORTAK_PARAMS,
  accentColor: '#0071e3',
});

export const agTemaKoyu = themeQuartz.withPart(colorSchemeDark).withParams({
  ...ORTAK_PARAMS,
  accentColor: '#0a84ff',
  backgroundColor: '#1c1c1e',
  chromeBackgroundColor: '#161618',
  borderColor: '#3a3a3c',
});
