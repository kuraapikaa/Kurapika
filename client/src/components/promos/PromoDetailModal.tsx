import { X } from 'lucide-react';
import type { PromoListItem } from '../../types/promos';

interface PromoDetailModalProps {
  promo: PromoListItem | null;
  onClose: () => void;
}

/** Renders a single promo's detail HTML in a modal. Content is from fetch-promos-details (popup inner HTML). */
export function PromoDetailModal({ promo, onClose }: PromoDetailModalProps) {
  if (!promo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={promo.title}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/50 px-3 py-2.5">
          <h2 className="truncate pr-4 text-lg font-semibold text-white">{promo.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-strong:text-white prose-headings:text-white"
            dangerouslySetInnerHTML={{
              __html: promo.detailHtml
                ? promo.detailHtml
                    .replace(/<i id="close_popup_button_id"[^>]*>[\s\S]*?<\/i>/i, '')
                    .replace(/<input[^>]*type="checkbox"[^>]*>/gi, '')
                : '<p class="text-slate-500">Detay yok.</p>',
            }}
          />
        </div>
      </div>
    </div>
  );
}
