export function ProductIdentity() {
  return (
    <div className="flex h-full items-center gap-3" data-dream-region="product-identity">
      <div className="relative grid size-11 shrink-0 place-items-center" aria-hidden="true">
        <div className="absolute inset-1 rotate-45 rounded-[10px] border border-[var(--dream-gold)] shadow-[var(--dream-glow-gold)]" />
        <span className="relative text-xl font-semibold text-[var(--dream-gold-hot)]">S</span>
      </div>
      <div className="min-w-0">
        <div className="whitespace-nowrap text-[13px] font-semibold tracking-[0.2em] text-[var(--dream-gold-hot)]">S.H.A.G.G.Y.</div>
        <div className="mt-0.5 truncate text-[11px] uppercase tracking-[0.16em] text-[var(--dream-muted)]">AI Operating System</div>
      </div>
    </div>
  );
}