-- NOT: drizzle-kit'in urettigi sira ("dikey" var olmadan once o sutunu
-- iceren PRIMARY KEY eklemeye calisiyordu) elle DUZELTILDI. Sutun once
-- eklenmeli, kisit ondan SONRA gelmeli -- aksi halde bu migrasyon
-- gercek bir veritabaninda basarisiz olurdu.
ALTER TABLE "aff_olcumler" ADD COLUMN "dikey" text DEFAULT 'bilinmiyor' NOT NULL;--> statement-breakpoint
ALTER TABLE "aff_olcumler" DROP CONSTRAINT "aff_olcumler_kiraci_gun_ortak_anahtari_pk";--> statement-breakpoint
ALTER TABLE "aff_olcumler" ADD CONSTRAINT "aff_olcumler_kiraci_gun_ortak_anahtari_dikey_pk" PRIMARY KEY("kiraci","gun","ortak_anahtari","dikey");--> statement-breakpoint
CREATE INDEX "aff_olcumler_kiraci_ortak_dikey" ON "aff_olcumler" USING btree ("kiraci","ortak_anahtari","dikey");