ALTER TABLE "aff_oyuncu_eslesmeleri" ADD COLUMN "baglanti_id" text DEFAULT 'varsayilan' NOT NULL;--> statement-breakpoint
ALTER TABLE "aff_oyuncu_gunluk_rapor" ADD COLUMN "baglanti_id" text DEFAULT 'varsayilan' NOT NULL;--> statement-breakpoint
ALTER TABLE "aff_oyuncu_eslesmeleri" DROP CONSTRAINT "aff_oyuncu_eslesmeleri_kiraci_lynon_oyuncu_id_pk";--> statement-breakpoint
ALTER TABLE "aff_oyuncu_gunluk_rapor" DROP CONSTRAINT "aff_oyuncu_gunluk_rapor_kiraci_gun_oyuncu_id_pk";--> statement-breakpoint
ALTER TABLE "aff_oyuncu_eslesmeleri" ADD CONSTRAINT "aff_oyuncu_eslesmeleri_kiraci_baglanti_id_lynon_oyuncu_id_pk" PRIMARY KEY("kiraci","baglanti_id","lynon_oyuncu_id");--> statement-breakpoint
ALTER TABLE "aff_oyuncu_gunluk_rapor" ADD CONSTRAINT "aff_oyuncu_gunluk_rapor_kiraci_baglanti_id_gun_oyuncu_id_pk" PRIMARY KEY("kiraci","baglanti_id","gun","oyuncu_id");
