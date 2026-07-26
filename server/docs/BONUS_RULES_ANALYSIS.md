# Bonus KurallarÄ± Analizi (Ä°nbahis)

Bu dokÃ¼man, `promotions-data.json` ve sitedeki bonus kurallarÄ±na gÃ¶re hazÄ±rlanmÄ±ÅŸtÄ±r. Otomatik Ã§ekim modÃ¼lÃ¼ bu kurallarÄ± kullanarak Ã§evrim ve Ã§ekim limiti kontrolÃ¼ yapar.

---

## Ortak Kurallar (Genel)

- **AynÄ± anda tek bonus:** Ãœye aynÄ± anda sadece bir bonustan yararlanabilir.
- **Ã‡evrim sÃ¼resi:** Aksi belirtilmedikÃ§e bonus 30 gÃ¼n (1 ay) iÃ§inde Ã§evrilmeli.
- **Ã‡ekim limitleri (Genel):**
  - 5000â‚º altÄ± yatÄ±rÄ±m: max anapara Ã— 30 Ã§ekim
  - 5001â€“20.000â‚º: 80 katÄ±na kadar
  - 20.001â‚º+: VIP limiti

---

## 1. %100 Casino - CanlÄ± Casino HoÅŸ geldin Bonusu

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 2.500â‚º |
| Max bonus | 10.000â‚º |
| Anapara Ã§evrim | 1x (son yatÄ±rÄ±m) |
| Bonus Ã§evrim | 1x |
| Oyun | CanlÄ± Casino (rulet: max 19 sayÄ±; 1'e 2 oran dahil deÄŸil) |
| Max kazanÃ§ | Bonusun 30 katÄ± |
| Not | Ä°lk yatÄ±rÄ±m; Ã§ekimde bonus bakiyeden dÃ¼ÅŸÃ¼lÃ¼r |

**Otomatik Ã§ekim spec:** `minDep: 2500, principalWagerMult: 1, bonusWagerMult: 1, maxPayoutMult: 30`

---

## 2. %100 Spor HoÅŸgeldin Bonusu

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 2.500â‚º |
| Max bonus | 2.500â‚º |
| Anapara Ã§evrim | 1x |
| Bonus Ã§evrim | 5x (tekli 2.00+, kombine her maÃ§ 2.00+) |
| Oyun | Futbol, basketbol |
| Max kazanÃ§ | 30 kat |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 2500, principalWagerMult: 1, bonusWagerMult: 5, maxPayoutMult: 30`

---

## 3. %25 Casino Ã‡evrimsiz

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Ã‡evrim | Bonus + anapara 1x (spor: 1.50+ oran, en az 1 karÅŸÄ±laÅŸma; casino/canlÄ±: toplam 1x) |
| Rulet | Max 19 sayÄ±; 1'e 2, 1'e 3 oran dahil deÄŸil |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1`

---

## 4. %25 Spor Ã‡evrimsiz

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Max bonus | 20.000â‚º |
| Ã‡evrim | Bonus 1x, 1.50+ oran; sonra ana bakiyeye geÃ§er |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1`

---

## 5. Her YatÄ±rÄ±ma Freespin / HER GÃœN 500 FREESPÄ°N

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Freespin | 1â€“4.999â‚º: 100; 5â€“24.999â‚º: 200; 25.000â‚º+: 500 |
| Ã‡evrim | Slotâ€™ta 1 kat |
| Ã‡ekim limiti | Min 1.000â‚º, max bonustan 10 kat veya 5.000â‚º |
| GeÃ§erlilik | 24 saat |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1, maxPayoutMult: 10, maxPayoutFixed: 5000`

---

## 6. %20 Casino Discount (KayÄ±p bonusu)

| Alan | DeÄŸer |
|------|--------|
| Min kayÄ±p | 1.000â‚º (gÃ¼n iÃ§i yatÄ±rÄ±mâ€“Ã§ekim farkÄ±) |
| Ã‡evrim | Casino/canlÄ±: (yatÄ±rÄ±m + bonus) 1x; rulet 19 sayÄ± kuralÄ± |
| Max kazanÃ§ | 30 kat; 1 Ã§ekim |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1, maxPayoutMult: 30`

---

## 7. %20 Spor Discount (KayÄ±p bonusu)

| Alan | DeÄŸer |
|------|--------|
| Min kayÄ±p | 1.000â‚º |
| Ã‡evrim | Spor 1.50+ oran 1x; son Ã§ekim baz alÄ±nÄ±r |
| Max kazanÃ§ | 30 kat |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1, maxPayoutMult: 30`

---

## 8. %50 Pazartesi Bonusu

| Alan | DeÄŸer |
|------|--------|
| YatÄ±rÄ±m | Min 200â‚º, max 10.000â‚º |
| Bonus | Min 100â‚º, max 5.000â‚º |
| Ã‡evrim | (YatÄ±rÄ±m + bonus) Ã— 30 (spor: 1.50+ 2 maÃ§ kombine; slot/canlÄ±: 1x bonus sonra 30x) |
| Max Ã§ekim | 30Ã— yatÄ±rÄ±m veya 100.000â‚º |

**Otomatik Ã§ekim spec:** `minDep: 200, principalWagerMult: 30, bonusWagerMult: 30, maxPayoutMult: 30, maxPayoutFixed: 100000`

---

## 9. %30 CanlÄ± Ve Slot Vip Discount

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 20.000â‚º |
| Ã‡evrim | Yok (1 defa kullanÄ±m, kazanÃ§ ana bakiyeye) |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 20000, principalWagerMult: 0, bonusWagerMult: 0`

---

## 10. Ä°nbahis Avrupa KupasÄ± HeycanÄ± (%50 Avrupa)

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 500â‚º |
| Ã‡evrim | (YatÄ±rÄ±m + bonus) 5x; UEFA turnuvalarÄ±, 1.50+ 2 maÃ§ kombine |
| Max kazanÃ§ | 30Ã— yatÄ±rÄ±m, max 100.000â‚º |

**Otomatik Ã§ekim spec:** `minDep: 500, principalWagerMult: 5, bonusWagerMult: 5, maxPayoutMult: 30, maxPayoutFixed: 100000`

---

## 11. %40 DÃ¼ÅŸÃ¼k Ã‡evrimli Bonus

| Alan | DeÄŸer |
|------|--------|
| YatÄ±rÄ±m | Tek seferde 500â€“1.000â‚º |
| Ã‡evrim | CanlÄ± casino: anapara 1x + bonus 30x (rulet kurallarÄ±: 18+ sayÄ±, dÄ±ÅŸ bahisler hariÃ§) |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 500, principalWagerMult: 1, bonusWagerMult: 30`

---

## 12. %10 Spor Ã‡evrimsiz

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Max bonus | 10.000â‚º |
| Ã‡evrim | Bonus 1x, 1.50+ oran; E-spor/Cyber/Sanal hariÃ§ |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1`

---

## 13. HaftalÄ±k %5 Discount (KayÄ±p bonusu)

| Alan | DeÄŸer |
|------|--------|
| GÃ¼nlÃ¼k min yatÄ±rÄ±m | 1.000â‚º |
| Max haftalÄ±k kayÄ±p bonusu | 20.000â‚º |
| Ã‡evrim | Spor 1.50+ 1x; bonus 1x Ã§evrim, max 30 kat kazanÃ§ |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1, maxPayoutMult: 30`

---

## 14. %10 Casino Ã‡evrimsiz

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Ã‡evrim | Casino/canlÄ±: (yatÄ±rÄ±m + bonus) 1x; rulet 19 sayÄ± kuralÄ± |
| SÃ¼re | 30 gÃ¼n |

**Otomatik Ã§ekim spec:** `minDep: 1000, principalWagerMult: 1, bonusWagerMult: 1`

---

## 15. Vip Club

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m (Bronz) | 50.000â‚º tek seferde |
| DiÄŸer kademeler | Silver 100k, Gold 250k, Platinyum 500k |

**Otomatik Ã§ekim spec:** `minDep: 50000` (Ã§ekim kontrolÃ¼nde alt sÄ±nÄ±r)

---

## 16. Ã‡ekim PaylaÅŸ Freespin

| Alan | DeÄŸer |
|------|--------|
| Min yatÄ±rÄ±m | 1.000â‚º |
| Min Ã§ekim | 3.000â‚º (paylaÅŸÄ±m iÃ§in) |
| Ã–zel | Etkinlik/harici bonus Ã§ekimleri sayÄ±lmaz |

**Otomatik Ã§ekim spec:** `minDep: 1000` (min Ã§ekim 3000â‚º manuel doÄŸrulama)

---

## 17. DoÄŸum GÃ¼nÃ¼ Bonusu

| Alan | DeÄŸer |
|------|--------|
| Ä°Ã§erik | 250 Freespin (Golden Unicorn delux) + 1 yatÄ±rÄ±ma Ã§evrimsiz %100 |
| Max Ã§ekim | 5.000â‚º (banka havalesi) |

**Otomatik Ã§ekim spec:** `maxPayoutFixed: 5000`

---

## 18â€“19. Google Authenticator / Genel Bonus KurallarÄ±

Bilgi sayfalarÄ±; bonus spec yok. EÅŸleÅŸirse otomatik Ã§ekimde ek kural uygulanmaz.

---

## Sistem bonus ID eÅŸlemesi (Backoffice / CMS)

GetClientBonuses veya CMSâ€™ten gelen bonus **Id** aÅŸaÄŸÄ±daki gibi eÅŸleÅŸtirilirse `PROMO_SPECS[id]` kullanÄ±lÄ±r; yoksa baÅŸlÄ±k (Name/title) normalize edilip `PROMO_TITLE_SPECS` ile eÅŸleÅŸir.

| ID | Promosyon |
|----|-----------|
| 31103 | %100 Casino - CanlÄ± Casino HoÅŸ geldin Bonusu |
| 31104 | %100 Spor HoÅŸgeldin Bonusu |
| 188758 | %25 Casino Ã‡evrimsiz |
| 188765 | %25 Spor Ã‡evrimsiz |
| 31099 | Her YatÄ±rÄ±ma Freespin |
| 31101 | %20 Casino Discount |
| 188764 | %20 Spor Discount |
| 848635 | %50 Pazartesi Bonusu |
| 31097 | %30 CanlÄ± Ve Slot Vip Discount |
| 845878 | Ä°nbahis Avrupa KupasÄ± HeycanÄ± |
| 845876 | %40 DÃ¼ÅŸÃ¼k Ã‡evrimli Bonus |
| 31102 | %10 Spor Ã‡evrimsiz |
| 845739 / 802984 | HaftalÄ±k %5 Discount |
| 188762 | %10 Casino Ã‡evrimsiz |

Kaynak: `promotions-data.json` (19 promosyon) + harici promosyon kuralları.

---

## Otomatik Ã§ekim motoru eÅŸlemesi

- `evaluateForAccount`: Her CMS promosyonu iÃ§in min yatÄ±rÄ±m, anapara Ã§evrim (principalWagerMult), bonus Ã§evrim (bonusWagerMult), max kazanÃ§ (maxPayoutMult / maxPayoutFixed) kontrol edilir.
- `evaluateBonusRules`: Hesaptaki her aktif bonus iÃ§in Ã§evrim (ToWagerAmount) ve varsa max kazanÃ§ limiti kontrol edilir.
- `evaluateWagerSummary`: Son yatÄ±rÄ±m sonrasÄ± anapara Ã§evrimi ve toplam bonus Ã§evrimi Ã¶zetlenir.
- Spec eÅŸlemesi: Ã–nce `PROMO_SPECS[promo.id]`, yoksa `PROMO_TITLE_SPECS` ile baÅŸlÄ±k eÅŸlemesi (normalize edilmiÅŸ title) kullanÄ±lÄ±r.

