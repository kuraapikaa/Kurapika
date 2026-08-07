CREATE TABLE "aff_olcumler" (
	"kiraci" text NOT NULL,
	"gun" text NOT NULL,
	"ortak_anahtari" text NOT NULL,
	"oyuncu_sayisi" integer DEFAULT 0 NOT NULL,
	"aktif_oyuncu_sayisi" integer DEFAULT 0 NOT NULL,
	"yatirim" double precision DEFAULT 0 NOT NULL,
	"cekim" double precision DEFAULT 0 NOT NULL,
	"ggr" double precision DEFAULT 0 NOT NULL,
	"ftd_sayisi" integer,
	"kaynak" text NOT NULL,
	"yazildi" timestamp with time zone NOT NULL,
	CONSTRAINT "aff_olcumler_kiraci_gun_ortak_anahtari_pk" PRIMARY KEY("kiraci","gun","ortak_anahtari")
);
--> statement-breakpoint
CREATE TABLE "aff_tiklamalar" (
	"click_id" text PRIMARY KEY NOT NULL,
	"kiraci" text NOT NULL,
	"ortak_anahtari" text NOT NULL,
	"medya_id" text,
	"alt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"user_agent" text,
	"referrer" text,
	"zaman" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "aff_olcumler_kiraci_gun" ON "aff_olcumler" USING btree ("kiraci","gun");--> statement-breakpoint
CREATE INDEX "aff_tiklamalar_kiraci_zaman" ON "aff_tiklamalar" USING btree ("kiraci","zaman" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "aff_tiklamalar_kiraci_ortak_zaman" ON "aff_tiklamalar" USING btree ("kiraci","ortak_anahtari","zaman" DESC NULLS LAST);