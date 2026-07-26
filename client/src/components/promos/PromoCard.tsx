import type { PromoListItem } from '../../types/promos';
import { Gift } from 'lucide-react';

interface PromoCardProps {
  promo: PromoListItem;
  onClick: () => void;
}

export function PromoCard({ promo, onClick }: PromoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 text-left transition-all hover:border-blue-500/30 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800/50">
        {promo.image ? (
          <img
            src={promo.image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            <Gift size={40} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex flex-1 flex-col justify-center p-4">
        <span className="line-clamp-2 text-sm font-bold text-slate-200 transition-colors group-hover:text-white">
          {promo.title}
        </span>
        {promo.detailHtml && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-blue-400/80">
            Detay
          </span>
        )}
      </div>
    </button>
  );
}
