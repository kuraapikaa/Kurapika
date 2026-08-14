import { Terminal, Activity, Cpu } from 'lucide-react';

export function ExecutionConsole() {
  return (
    <div className="group relative flex flex-col rounded-3xl border border-white/[0.05] bg-white/[0.02] shadow-2xl backdrop-blur-xl overflow-hidden h-[300px] transition-all duration-500 hover:border-cyan-500/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-500/20 blur-sm" />
            <Terminal size={14} className="text-cyan-400 relative z-10" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-500/80">Sistem İzleme Konsolu</span>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
            <Cpu size={10} className="text-slate-400" />
            <span className="text-[8px] font-bold text-slate-400">v1.4.0-STABLE</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="inline-flex p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] shadow-inner backdrop-blur-xl">
            <Activity size={32} className="text-cyan-500/50 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Sistem Hazır</h3>
            <p className="mt-1 text-[11px] text-slate-400 font-medium max-w-[240px] leading-relaxed">
              Otomatik çekim motoru aktif. Bekleyen talepler için <span className="text-cyan-500">Check Analiz</span> butonunu kullanın.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Gateway: Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Database: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-cyan-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Worker: Idle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="border-t border-white/5 bg-white/[0.02] px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-20" />
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Live Feed Subscribed</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-slate-500 tabular-nums">MS: 12ms</span>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[9px] font-mono text-slate-500 tabular-nums">MEM: 124MB</span>
        </div>
      </div>
    </div>
  );
}
