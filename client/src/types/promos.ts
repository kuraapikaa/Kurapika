/** Single promo from promotions-data.json (fetch-promos-details). */
export interface PromoListItem {
  title: string;
  image?: string;
  detailHtml?: string;
  href?: string;
  /** Freebet eşleştirmesi: GetFreeBetBonusesByFilter Objects[].DescriptionId ile eşleşir. */
  descriptionId?: number;
  /** promotions-data.json rule payload (optional). */
  rules?: Record<string, unknown>;
}

export interface PromosListData {
  promotions: PromoListItem[];
  fetchedAt?: string;
  source?: string;
}

export interface PromosListResponse {
  HasError: boolean;
  AlertMessage?: string;
  Data?: PromosListData;
}
