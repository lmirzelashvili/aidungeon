export function Button({ children, className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:text-violet-400",
    ghost: "bg-white/5 hover:bg-white/10 border border-white/10",
    danger: "bg-rose-600 hover:bg-rose-500",
  };
  return (
    <button
      className={`px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

// A labelled progress bar (health / integrity).
export function Bar({ value, max, color = "violet", label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = {
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-1 text-white/60">
          <span>{label}</span>
          <span>{Math.max(0, Math.round(value))}/{max}</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Score meter for the glass-box verdict.
export function ScoreMeter({ label, value, accent = "violet" }) {
  const colors = { violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", sky: "bg-sky-500" };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70">{label}</span>
        <span className="font-mono font-semibold">{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${colors[accent]} transition-all duration-1000`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}
