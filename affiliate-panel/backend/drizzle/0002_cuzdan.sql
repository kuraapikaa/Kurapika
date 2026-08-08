CREATE TABLE "aff_cuzdan_hareketleri" (
	"id" text PRIMARY KEY NOT NULL,
	"kiraci" text NOT NULL,
	"ortak_id" text NOT NULL,
	"tur" text NOT NULL,
	"tutar" double precision NOT NULL,
	"donem" text,
	"aciklama" text,
	"kaynak_anahtari" text NOT NULL,
	"olusturuldu" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "aff_cuzdan_kiraci_kaynak" ON "aff_cuzdan_hareketleri" USING btree ("kiraci","kaynak_anahtari");--> statement-breakpoint
CREATE INDEX "aff_cuzdan_kiraci_ortak" ON "aff_cuzdan_hareketleri" USING btree ("kiraci","ortak_id");