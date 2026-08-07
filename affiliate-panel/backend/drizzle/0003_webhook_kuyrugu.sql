CREATE TABLE "aff_oyuncu_gunluk" (
	"kiraci" text NOT NULL,
	"gun" text NOT NULL,
	"oyuncu_id" text NOT NULL,
	"yatirim" double precision DEFAULT 0 NOT NULL,
	"cekim" double precision DEFAULT 0 NOT NULL,
	"bahis" double precision DEFAULT 0 NOT NULL,
	"kazanc" double precision DEFAULT 0 NOT NULL,
	"olay_sayisi" integer DEFAULT 0 NOT NULL,
	"guncellendi" timestamp with time zone NOT NULL,
	CONSTRAINT "aff_oyuncu_gunluk_kiraci_gun_oyuncu_id_pk" PRIMARY KEY("kiraci","gun","oyuncu_id")
);
--> statement-breakpoint
CREATE TABLE "aff_webhook_olaylari" (
	"id" text PRIMARY KEY NOT NULL,
	"kiraci" text NOT NULL,
	"imza" text NOT NULL,
	"olay_turu" text NOT NULL,
	"oyuncu_id" text NOT NULL,
	"tutar" double precision DEFAULT 0 NOT NULL,
	"govde" jsonb NOT NULL,
	"durum" text NOT NULL,
	"deneme" integer DEFAULT 0 NOT NULL,
	"son_hata" text,
	"alindi" timestamp with time zone NOT NULL,
	"islendi" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "aff_oyuncu_gunluk_kiraci_gun" ON "aff_oyuncu_gunluk" USING btree ("kiraci","gun");--> statement-breakpoint
CREATE UNIQUE INDEX "aff_webhook_kiraci_imza" ON "aff_webhook_olaylari" USING btree ("kiraci","imza");--> statement-breakpoint
CREATE INDEX "aff_webhook_kiraci_durum_alindi" ON "aff_webhook_olaylari" USING btree ("kiraci","durum","alindi");