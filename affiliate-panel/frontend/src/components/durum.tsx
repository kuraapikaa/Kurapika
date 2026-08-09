import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

/**
 * SAYFA DURUMLARI — yükleniyor / hata / boş liste.
 *
 * Her veri çeken yönetim sayfası aynı üç durumu tekrar tekrar
 * çiziyordu (`ui.tsx`'teki `Yukleniyor`/`Hata`/`Bos`); bu, Shadcn
 * `Skeleton`/`Alert` üzerine kurulu Shadcn karşılığı.
 */
export function Yukleniyor({ satir = 3 }: { satir?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: satir }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function HataMesaji({ mesaj }: { mesaj: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{mesaj}</AlertDescription>
    </Alert>
  );
}

export function BosDurum({ mesaj }: { mesaj: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{mesaj}</p>;
}
