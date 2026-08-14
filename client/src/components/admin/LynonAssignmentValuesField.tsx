import { useEffect, useState } from 'react';

export function LynonAssignmentValuesField({
  label = 'Lynon assignmentValues',
  values,
  onChange,
}: {
  label?: string;
  values?: Record<string, unknown> | null;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const serialized = JSON.stringify(values ?? {}, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(serialized);
  }, [serialized, focused]);

  const commit = () => {
    setFocused(false);
    try {
      const parsed = JSON.parse(text || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON nesne olmalı.');
      onChange(parsed);
      setError(null);
      setText(JSON.stringify(parsed, null, 2));
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Geçersiz JSON');
    }
  };

  return (
    <label className="block space-y-2 rounded-3xl border border-amber-300/10 bg-[color:var(--panel-warning,#ff9f0a)]/[0.025] p-8 backdrop-blur-xl">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">{label}</span>
      <textarea
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        spellCheck={false}
        className="min-h-[92px] w-full resize-y rounded-3xl border border-white/[0.05] bg-black/40 p-8 font-mono text-[10px] leading-relaxed text-amber-100 outline-none focus:border-amber-300/40 backdrop-blur-xl"
        placeholder={'{\n  "BonusMoneyAmount": 200\n}'}
      />
      {error && <span className="block text-[10px] font-bold text-rose-300">{error}</span>}
    </label>
  );
}