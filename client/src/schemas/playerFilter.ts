import { z } from 'zod';

/** Oyuncu arama / filtre formu validasyonu */
export const playerFilterSchema = z.object({
  login: z.string().max(100).optional(),
  bTag: z.string().max(50).optional(),
});

export type PlayerFilterForm = z.infer<typeof playerFilterSchema>;
