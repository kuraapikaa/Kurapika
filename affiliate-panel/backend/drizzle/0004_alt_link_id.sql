ALTER TABLE "aff_oyuncu_eslesmeleri" ADD COLUMN "alt_link_id" text;--> statement-breakpoint
ALTER TABLE "aff_tiklamalar" ADD COLUMN "alt_link_id" text;--> statement-breakpoint
CREATE INDEX "aff_eslesme_kiraci_altlink" ON "aff_oyuncu_eslesmeleri" USING btree ("kiraci","alt_link_id");--> statement-breakpoint
CREATE INDEX "aff_tiklamalar_kiraci_altlink" ON "aff_tiklamalar" USING btree ("kiraci","alt_link_id");