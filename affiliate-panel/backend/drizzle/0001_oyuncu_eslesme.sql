CREATE TABLE "aff_eslesme_cakismalari" (
	"id" text PRIMARY KEY NOT NULL,
	"kiraci" text NOT NULL,
	"lynon_oyuncu_id" text NOT NULL,
	"denenen_ortak_id" text NOT NULL,
	"denenen_ortak_anahtari" text NOT NULL,
	"mevcut_ortak_id" text NOT NULL,
	"zaman" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aff_oyuncu_eslesmeleri" (
	"kiraci" text NOT NULL,
	"lynon_oyuncu_id" text NOT NULL,
	"ortak_id" text NOT NULL,
	"ortak_anahtari" text NOT NULL,
	"click_id" text,
	"medya_id" text,
	"alt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kaynak" text NOT NULL,
	"olusturuldu" timestamp with time zone NOT NULL,
	CONSTRAINT "aff_oyuncu_eslesmeleri_kiraci_lynon_oyuncu_id_pk" PRIMARY KEY("kiraci","lynon_oyuncu_id")
);
--> statement-breakpoint
CREATE INDEX "aff_cakisma_kiraci_zaman" ON "aff_eslesme_cakismalari" USING btree ("kiraci","zaman" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "aff_cakisma_kiraci_denenen" ON "aff_eslesme_cakismalari" USING btree ("kiraci","denenen_ortak_id");--> statement-breakpoint
CREATE INDEX "aff_eslesme_kiraci_ortak" ON "aff_oyuncu_eslesmeleri" USING btree ("kiraci","ortak_id");--> statement-breakpoint
CREATE INDEX "aff_eslesme_kiraci_zaman" ON "aff_oyuncu_eslesmeleri" USING btree ("kiraci","olusturuldu" DESC NULLS LAST);