import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESETS = [
  '#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#3b82f6', 
  '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#27272a',
  '#ffffff', '#000000', '#3b82f6', '#ef4444', '#8b5cf6'
];

export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {label && <label className="text-[10px] uppercase text-[color:var(--panel-muted,#8a919c)] font-bold mb-1 block">{label}</label>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-9 w-full items-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] px-2 transition-all hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
      >
        <div 
          className="h-5 w-5 rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-sm" 
          style={{ backgroundColor: color }} 
        />
        <span className="text-[11px] font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] uppercase tracking-tight">{color}</span>
        <Pipette size={12} className="ml-auto text-[color:var(--panel-muted,#8a919c)] group-hover:text-[color:var(--panel-text-dim,#c8cdd5)]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute left-0 top-full z-[70] mt-2 w-48 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-3 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase">Renk Seçin</span>
                <button onClick={() => setIsOpen(false)} className="rounded-md p-1 hover:bg-white/5">
                   <X size={12} className="text-[color:var(--panel-muted,#8a919c)]" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      onChange(p);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "h-6 w-6 rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] transition-transform hover:scale-110",
                      color === p && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900"
                    )}
                    style={{ backgroundColor: p }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-black/40 p-1.5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded bg-transparent p-0 border-0"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full bg-transparent text-[10px] font-semibold text-white outline-none"
                  placeholder="#000000"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
