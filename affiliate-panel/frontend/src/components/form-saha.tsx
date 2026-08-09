import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

/**
 * FORM SAHASI — etiket + girdi + ipucu üçlüsü.
 *
 * `Landing.tsx`'teki giriş kutusu ve `Basvuru.tsx`'teki başvuru formu
 * ikisi de aynı üç parçayı tekrar tekrar diziyordu; bu, Shadcn'in
 * `Label`/`Input`/`Textarea`/`Select` primitiflerini saran tek bir ince
 * katman — eski `ui.tsx`'teki `Alan`'ın yerini alıyor ama artık
 * altındaki her şey gerçek Shadcn bileşeni.
 */
export interface FormSahaProps {
  id: string;
  etiket: string;
  deger: string;
  degisti: (yeni: string) => void;
  tip?: 'text' | 'email' | 'password' | 'number';
  ipucu?: string;
  cokSatir?: boolean;
  secenekler?: Array<{ deger: string; etiket: string }>;
  zorunlu?: boolean;
}

export function FormSaha({
  id, etiket, deger, degisti, tip = 'text', ipucu, cokSatir, secenekler, zorunlu,
}: FormSahaProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiket}{zorunlu && ' *'}</Label>
      {secenekler ? (
        <Select value={deger} onValueChange={degisti}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {secenekler.map((s) => (
              <SelectItem key={s.deger} value={s.deger}>{s.etiket}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : cokSatir ? (
        <Textarea id={id} value={deger} onChange={(e) => degisti(e.target.value)} rows={3} />
      ) : (
        <Input id={id} type={tip} value={deger} onChange={(e) => degisti(e.target.value)} />
      )}
      {ipucu && <p className="text-xs text-muted-foreground">{ipucu}</p>}
    </div>
  );
}

/** Gönderim hatası — Shadcn'in kendi `destructive` tonunu kullanan basit bir satır. */
export function FormHata({ mesaj }: { mesaj: string }) {
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {mesaj}
    </p>
  );
}
