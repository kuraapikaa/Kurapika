CREATE TABLE "aff_oyuncu_gunluk_rapor" (
	"kiraci" text NOT NULL,
	"gun" text NOT NULL,
	"oyuncu_id" text NOT NULL,
	"yatirim" double precision DEFAULT 0 NOT NULL,
	"cekim" double precision DEFAULT 0 NOT NULL,
	"bahis" double precision DEFAULT 0 NOT NULL,
	"kazanc" double precision DEFAULT 0 NOT NULL,
	"guncellendi" timestamp with time zone NOT NULL,
	CONSTRAINT "aff_oyuncu_gunluk_rapor_kiraci_gun_oyuncu_id_pk" PRIMARY KEY("kiraci","gun","oyuncu_id")
);
--> statement-breakpoint
CREATE INDEX "aff_oyuncu_gunluk_rapor_kiraci_gun" ON "aff_oyuncu_gunluk_rapor" USING btree ("kiraci","gun");