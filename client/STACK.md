# Frontend Stack

Bu proje aşağıdaki modern frontend kütüphaneleri ile geliştirilmiştir.

## Çekirdek

| Teknoloji | Kullanım |
|-----------|----------|
| **React 18** | UI |
| **TypeScript** | Tip güvenliği (strict mode) |
| **Vite 5** | Derleme ve HMR |
| **React Router 7** | Sayfa yönlendirme |
| **Tailwind CSS** | Stil |

## Veri & State

| Teknoloji | Kullanım |
|-----------|----------|
| **TanStack Query (React Query) v5** | Sunucu state, cache, refetch |
| **Zustand** | İstemci/global state (ör: `src/store/uiStore.ts`) |

## Formlar & Validasyon

| Teknoloji | Kullanım |
|-----------|----------|
| **React Hook Form** | Performanslı form yönetimi |
| **Zod** | Şema tabanlı validasyon |
| **@hookform/resolvers** | Zod ↔ React Hook Form entegrasyonu |

Örnek şema: `src/schemas/playerFilter.ts`

## UI & Erişilebilirlik

| Teknoloji | Kullanım |
|-----------|----------|
| **Radix UI** | Erişilebilir primitifler (Dialog, Tabs, Select, Dropdown) |
| **Lucide React** | İkon seti |
| **Framer Motion** | Sayfa/komponent animasyonları |
| **clsx** + **tailwind-merge** | `cn()` ile sınıf birleştirme (`src/lib/utils.ts`) |

## Test

| Teknoloji | Kullanım |
|-----------|----------|
| **Vitest** | Birim ve entegrasyon testleri |
| **React Testing Library** | Bileşen testleri |
| **jsdom** | DOM ortamı |
| **@testing-library/jest-dom** | Ek matcher'lar |

Komutlar:

- `npm run test` — watch modu
- `npm run test:run` — tek seferlik
- `npm run test:ui` — Vitest UI

## Proje Yapısı (özet)

- `src/store/` — Zustand store'ları
- `src/schemas/` — Zod şemaları
- `src/lib/utils.ts` — `cn()` ve ortak yardımcılar
- `src/components/ui/` — Radix + Tailwind ile yeniden kullanılabilir UI bileşenleri
- `src/test/setup.ts` — Vitest global kurulumu
